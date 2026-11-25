const secondsPerDay = 86400;
const searchWindow = 6 * 3600;
const modes = { tram:1, rail:1, bus:2 };
const maxRides = 3;
const transferBuffer = 120;

function dateKey(date) {
  return date.toISOString().slice(0,10).replaceAll('-','');
}

export function isScheduleDate(schedule,value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0,10) !== value) return false;
  const key = dateKey(day);
  return key >= schedule.start && key <= schedule.end;
}

function departureInstances(schedule,date,start,end) {
  const midnight = Date.parse(date);
  const days = [-1,0,1].map(offset=>{
    const serviceDay = new Date(midnight + offset*secondsPerDay*1000);
    const key = dateKey(serviceDay);
    return {offset:offset*secondsPerDay,key,weekday:serviceDay.getUTCDay()};
  }).filter(day=>day.key>=schedule.start && day.key<=schedule.end);
  const all = [];
  for (const day of days) {
    const available = schedule.services.map(([from,to,week,exceptions])=>{
      const exception = exceptions[day.key];
      return exception ? exception===1 : day.key>=from && day.key<=to && week[day.weekday]===1;
    });
    for (const [patternId, service, firstArrival] of schedule.journeys) {
      if (!available[service]) continue;
      const pattern = schedule.patterns[patternId];
      const base = firstArrival+day.offset;
      if (base>end || base+pattern.at(-2)<start) continue;
      all.push({pattern,base});
    }
  }
  return all;
}

function keepLabel(labels,label) {
  // A faster arrival with no more walking can always make the same onward departure.
  if (labels.some(old=>old.mask===label.mask && old.time<=label.time && old.walk<=label.walk)) return;
  for (let i=labels.length-1;i>=0;i--) {
    const old = labels[i];
    if (old.mask===label.mask && label.time<=old.time && label.walk<=old.walk) labels.splice(i,1);
  }
  labels.push(label);
}

function walkOptions(stops, matrix, current, maxWalk, until, previousRides) {
  const ready = Array.from({length:matrix.length},()=>[]);
  for (const at of current) {
    for (const stop of stops) {
      const duration = matrix[at.stop][stop];
      if (!Number.isFinite(duration) || at.walk+duration>maxWalk) continue;
      const time = at.time+duration;
      if (time+(previousRides ? transferBuffer : 0)>until) continue;
      const legs = duration || stop!==at.stop ? [...at.legs,{mode:'walk',from:at.stop,to:stop,start:at.time,end:time}] : at.legs;
      keepLabel(ready[stop],{time,walk:at.walk+duration,mask:at.mask,legs});
    }
  }
  return ready;
}

function rideOptions(schedule,instances,ready,until,previousRides) {
  const next = Array.from({length:schedule.points.length},()=>[]);
  for (const {pattern,base} of instances) {
    const route = pattern[0];
    const kind = modes[schedule.routes[route][2]];
    if (!kind) continue;
    const boarded = new Array(4);
    for (let i=1;i<pattern.length;i+=4) {
      const [stop,arrive,depart,flags] = pattern.slice(i,i+4);
      const time = base+arrive;
      if (time>until) break;
      if (flags&2) {
        for (const ride of boarded) {
          if (!ride || ride.stop===stop || time<=ride.departure) continue;
          keepLabel(next[stop],{stop,time,walk:ride.before.walk,mask:ride.mask,
            legs:[...ride.before.legs,{mode:'ride',route,from:ride.stop,to:stop,start:ride.departure,end:time}]});
        }
      }
      if (!(flags&1)) continue;
      const departure = base+depart;
      for (const before of ready[stop]) {
        if (before.time+(previousRides ? transferBuffer : 0)>departure) continue;
        const mask = before.mask|kind;
        if (!boarded[mask] || before.walk<boarded[mask].before.walk) boarded[mask]={stop,before,departure,mask};
      }
    }
  }
  return next.flat();
}

function signature(route) {
  return route.legs.map(leg=>[leg.mode,leg.route,leg.from,leg.to,leg.start].join('/')).join(';');
}

function summarize(candidates,mixed) {
  const fastest = (a,b)=>a.end-b.end || a.rides-b.rides || a.walk-b.walk;
  const selected = [];
  const seen = new Set();
  const patterns = mixed ? [3] : [0,1,2,3];
  for (const mask of patterns) {
    const group = candidates.filter(route=>route.mask===mask);
    if (!group.length) continue;
    const first = group.reduce((a,b)=>fastest(a,b)<=0?a:b);
    const leastWalk = group.reduce((a,b)=>a.walk<b.walk || (a.walk===b.walk&&fastest(a,b)<=0) ? a : b);
    // A small saving in walking should not double the total journey time.
    const alternatives = leastWalk.end<=first.end+25*60 && leastWalk.walk<first.walk ? [first,leastWalk] : [first];
    for (const route of alternatives) {
      const key = signature(route);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(route);
    }
  }
  return selected.sort(fastest);
}

export function searchRegion({schedule,walking}, {from,to,date,time,limit,mixed=false}) {
  const origin = schedule.points.findIndex(([id])=>id===from);
  const target = schedule.points.findIndex(([id])=>id===to);
  if (origin<0 || target<0 || origin===target || ![30,60,120].includes(limit) || !isScheduleDate(schedule,date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  const [hours,minutes] = time.split(':').map(Number);
  const start=hours*3600+minutes*60, until=start+searchWindow, maxWalk=limit*60;
  const instances = departureInstances(schedule,date,start,until);
  const transitStops = schedule.points.map((point,index)=>point[2]!=='place' ? index : -1).filter(index=>index>=0);
  const candidates = [];
  let current = [{stop:origin,time:start,walk:0,mask:0,legs:[]}];
  for (let rides=0; rides<=maxRides && current.length; rides++) {
    for (const label of current) {
      if (mixed && label.mask!==3) continue;
      const walk = walking[label.stop][target];
      if (!Number.isFinite(walk) || label.walk+walk>maxWalk || label.time+walk>until) continue;
      const end = label.time+walk;
      const legs = walk || label.stop!==target ? [...label.legs,{mode:'walk',from:label.stop,to:target,start:label.time,end}] : label.legs;
      const prices = legs.filter(leg=>leg.mode==='ride').map(leg=>schedule.routes[leg.route][3]);
      const fare = prices.every(Number.isFinite) ? prices.reduce((sum,x)=>sum+x,0) : null;
      candidates.push({start,end,walk:label.walk+walk,rides,mask:label.mask,legs,fare});
    }
    if (rides===maxRides) break;
    current = rideOptions(schedule,instances,walkOptions(transitStops,walking,current,maxWalk,until,rides),until,rides);
  }
  return summarize(candidates,mixed);
}
