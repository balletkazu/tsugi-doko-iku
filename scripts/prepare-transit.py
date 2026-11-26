#!/usr/bin/env python3
"""Rebuild and validate the approved regional feeds. Network requests are build-time only."""
import argparse
import csv
import hashlib
import io
import itertools
import json
import math
import re
import sys
import time
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
BROWSER_DATA = ROOT / 'public' / 'data'
USER_AGENT = 'TsugiDokoIku/0.4 (https://github.com/balletkazu/tsugi-doko-iku)'
OSRM_TABLE = 'https://routing.openstreetmap.de/routed-foot/table/v1/driving/'
ALLOWED_LICENSES = {'CC0-1.0', 'CC-BY-4.0'}
SERVICE_DAYS = ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')
MAX_FILE = 20 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def download(url):
    require(url.startswith('https://'), 'Source must use HTTPS')
    request = Request(url, headers={'User-Agent': USER_AGENT})
    with urlopen(request, timeout=45) as response:
        raw = response.read(MAX_FILE + 1)
    require(len(raw) <= MAX_FILE, 'Source exceeds the regional intake size limit')
    return raw


def records(archive, name, *, required=True):
    file = f'{name}.txt'
    if not required and file not in archive.namelist():
        return []
    require(archive.getinfo(file).file_size <= MAX_FILE, f'{file} exceeds intake size limit')
    return list(csv.DictReader(io.StringIO(archive.read(file).decode('utf-8-sig'), newline='')))


def seconds(value):
    require(len(value.split(':')) == 3, f'Invalid GTFS time: {value}')
    hour, minute, second = map(int, value.split(':'))
    require(0 <= hour < 48 and 0 <= minute < 60 and 0 <= second < 60, f'Invalid GTFS time: {value}')
    return hour * 3600 + minute * 60 + second


def date_key(value):
    require(len(value) == 8, f'Invalid GTFS date: {value}')
    datetime.strptime(value, '%Y%m%d')
    return value


def keyed(rows, column):
    result = {row[column]: row for row in rows}
    require(len(result) == len(rows) and '' not in result, f'Invalid or duplicate {column}')
    return result


def simple_fares(archive):
    fares = keyed(records(archive, 'fare_attributes', required=False), 'fare_id')
    by_route = defaultdict(set)
    unsupported = set()
    for rule in records(archive, 'fare_rules', required=False):
        route_id = rule.get('route_id', '')
        fare = fares[rule['fare_id']]
        if any(rule.get(key) for key in ('origin_id', 'destination_id', 'contains_id')):
            unsupported.add(route_id)
        elif fare['currency_type'] == 'JPY' and float(fare['price']).is_integer():
            by_route[route_id].add(int(float(fare['price'])))
        else:
            unsupported.add(route_id)
    return {key:next(iter(values)) for key, values in by_route.items() if len(values) == 1 and key not in unsupported}


def align_to_shape(line, points):
    """Match calls in trip order, including the last stop of circular services."""
    scale = math.cos(math.radians(points[0][0]))
    previous = []
    for lat, lon in points:
        candidates = []
        for i, ((a, b), (c, d)) in enumerate(zip(line, line[1:])):
            dy, dx = c-a, (d-b)*scale
            length = dx*dx + dy*dy
            fraction = max(0, min(1, ((lat-a)*dy+(lon-b)*scale*dx)/length)) if length else 0
            error = math.hypot(a+fraction*dy-lat,(b-lon)*scale+fraction*dx)*111200
            offset = round(i+fraction, 4)
            if error > 180:
                continue
            prior = [(cost, path) for cost, path in previous if path[-1] <= offset]
            if previous and not prior:
                continue
            cost, path = min(prior, key=lambda pair:pair[0]) if prior else (0, [])
            candidates.append((cost+error*error, [*path, offset]))
        if not candidates:
            return None
        previous = candidates
    return min(previous, key=lambda pair:pair[0])[1]


def ingest(source, raw, stops, routes, services, patterns, journeys, bounds, geometry):
    require(source['license'] in ALLOWED_LICENSES, f'Feed license needs review: {source["id"]}')
    feed_id = source['id']
    with ZipFile(io.BytesIO(raw)) as archive:
        agency = records(archive,'agency')
        require(agency and all(row['agency_timezone'] == 'Asia/Tokyo' for row in agency), 'Unexpected agency timezone')
        info, = records(archive, 'feed_info')
        require(info['feed_publisher_name'].strip() == source['publisher'], f'Publisher changed for {feed_id}')
        for table in ('frequencies','transfers','pathways'):
            require(not records(archive, table, required=False), f'Review required for {feed_id}/{table} rules')
        begin, end = date_key(info['feed_start_date']), date_key(info['feed_end_date'])
        require(begin <= end, f'Invalid feed dates in {feed_id}')
        local_stops = {}
        for stop_id, row in keyed(records(archive, 'stops'), 'stop_id').items():
            require(row.get('location_type', '') in ('', '0'), f'New stop location type in {feed_id}')
            lat, lon = float(row['stop_lat']), float(row['stop_lon'])
            south, west, north, east = bounds
            require(south <= lat <= north and west <= lon <= east and row['stop_name'], f'Unexpected stop: {stop_id}')
            local_stops[stop_id] = len(stops)
            stops.append([f'{feed_id}/{stop_id}', row['stop_name'], source['mode'], lat, lon])
        by_route = simple_fares(archive)
        local_routes = {}
        for route_id, row in keyed(records(archive, 'routes'), 'route_id').items():
            require(row['route_type'] in source['routeTypes'], f'Unapproved mode in {feed_id}/{route_id}')
            name = row['route_long_name'] or row['route_short_name']
            require(name, f'Missing route label: {route_id}')
            local_routes[route_id] = len(routes)
            routes.append([f'{feed_id}/{route_id}', name, source['mode'], by_route.get(route_id)])
        calendars = keyed(records(archive, 'calendar', required=False), 'service_id')
        exceptions = defaultdict(dict)
        for row in records(archive, 'calendar_dates', required=False):
            day, value = date_key(row['date']), int(row['exception_type'])
            require(value in (1, 2) and day not in exceptions[row['service_id']], 'Invalid or duplicate calendar exception')
            exceptions[row['service_id']][day] = value
        local_services = {}
        for key in dict.fromkeys((*calendars, *exceptions)):
            row = calendars.get(key)
            period = [date_key(row['start_date']), date_key(row['end_date'])] if row else [begin,end]
            days = [int(row[day]) for day in SERVICE_DAYS] if row else [0] * 7
            require(period[0] <= period[1] and all(x in (0,1) for x in days), 'Malformed calendar')
            local_services[key] = len(services)
            services.append([*period, days, exceptions[key]])
        trips = keyed(records(archive, 'trips'), 'trip_id')
        stop_times = defaultdict(list)
        for row in records(archive, 'stop_times'):
            require(row['trip_id'] in trips and row['stop_id'] in local_stops, 'Invalid stop time foreign key')
            codes = [row.get(key, '') or '0' for key in ('pickup_type','drop_off_type')]
            require(all(x in ('0','1','2','3') for x in codes), 'Invalid pickup/drop-off type')
            flags = int(codes[0] == '0') + 2 * int(codes[1] == '0')
            stop_times[row['trip_id']].append((int(row['stop_sequence']), local_stops[row['stop_id']], seconds(row['arrival_time']), seconds(row['departure_time']), flags))
        shape_rows = defaultdict(list)
        for point in records(archive, 'shapes', required=False):
            shape_rows[point['shape_id']].append((int(point['shape_pt_sequence']),round(float(point['shape_pt_lat']),6),round(float(point['shape_pt_lon']),6)))
        shape_ids = {}
        for key, rows in shape_rows.items():
            shape_ids[key] = len(geometry['lines'])
            geometry['lines'].append([row[1:] for row in sorted(rows)])
        alignments = {}
        pattern_index = {}
        for trip_id, row in trips.items():
            require(row['service_id'] in local_services and row['route_id'] in local_routes, f'Bad trip foreign key: {trip_id}')
            calls = sorted(stop_times[trip_id])
            require(len(calls) >= 2 and len({x[0] for x in calls}) == len(calls), f'Bad stop sequence: {trip_id}')
            base = calls[0][2]
            previous = base
            key = [local_routes[row['route_id']]]
            for _, stop, arrive, depart, flags in calls:
                require(previous <= arrive <= depart, f'Time going backwards: {trip_id}')
                previous = depart
                key.extend((stop, arrive-base, depart-base, flags))
            pattern = tuple(key)
            if pattern not in pattern_index:
                pattern_index[pattern] = len(patterns)
                patterns.append(pattern)
            line_id = shape_ids.get(row.get('shape_id'))
            alignment = None
            if line_id is not None:
                sequence = tuple(call[1] for call in calls)
                key = (line_id,sequence)
                if key not in alignments:
                    positions = align_to_shape(geometry['lines'][line_id], [stops[n][3:] for n in sequence])
                    alignments[key] = len(geometry['alignments']) if positions else None
                    if positions:
                        geometry['alignments'].append([line_id,positions])
                alignment = alignments[key]
            journeys.append([pattern_index[pattern], local_services[row['service_id']], base, alignment])
    return {'id':feed_id,'name':source['name'],'publisher':source['publisher'],'mode':source['mode'],
            'license':source['license'],'source':source['catalog'],'start':begin,'end':end,
            'version':info.get('feed_version',''),'sha256':hashlib.sha256(raw).hexdigest(), 'stops':len(local_stops),'trips':len(trips),
            **({'reviewNote':source['modeNote']} if source.get('modeNote') else {})}


def make_walk_matrix(stops):
    # Keep public OSRM work bounded and rate-limited. Use a compatible self-hosted export for larger regions.
    count = len(stops)
    require(1 <= count <= 150, 'Use a self-hosted walking export for larger areas')
    groups = [list(range(start, min(start+45,count))) for start in range(0,count,45)]
    blocks = [list(range(count))] if count <= 95 else [left+right for left,right in itertools.combinations(groups,2)]
    matrix = [[None]*count for _ in range(count)]
    snap = 0
    for n, block in enumerate(blocks):
        if n:
            time.sleep(1.15)
        coords = ';'.join(f'{stops[i][4]:.6f},{stops[i][3]:.6f}' for i in block)
        radius = ';'.join(['80']*len(block))
        response = json.loads(download(f'{OSRM_TABLE}{coords}?annotations=duration&radiuses={radius}'))
        require(response.get('code') == 'Ok' and len(response['durations']) == len(block), 'OSRM could not resolve the approved points')
        snap = max(snap, *(item['distance'] for item in response['sources']))
        for i, row in zip(block, response['durations']):
            require(len(row) == len(block), 'Incomplete walking response')
            for j, duration in zip(block, row):
                matrix[i][j] = None if duration is None else math.ceil(duration)
    require(snap <= 80, 'Pedestrian graph snap distance is over 80 m')
    return matrix, math.ceil(snap)


def validate_walk(matrix, count):
    require(len(matrix) == count and all(len(row) == count for row in matrix), 'Walking matrix size or stop order changed')
    for i, row in enumerate(matrix):
        require(row[i] == 0 and all(x is None or type(x) is int and x >= 0 for x in row), 'Invalid walking seconds')
    return sum(x is None for row in matrix for x in row)


def js_value(value):
    return json.dumps(value, ensure_ascii=False, separators=(',',':'))


def generate(args):
    catalog = json.loads(args.catalog.read_text())
    require(catalog['timezone'] == 'Asia/Tokyo', 'Unexpected region timezone')
    slug = catalog['outputSlug']
    require(re.fullmatch('[a-z][a-z0-9-]*',slug), 'Invalid regional file slug')
    bounds = catalog['bounds']
    require(len(bounds)==4 and bounds[0]<bounds[2] and bounds[1]<bounds[3], 'Invalid regional bounds')
    verified = datetime.strptime(args.as_of,'%Y-%m-%d').date()
    stops, routes, services, patterns, journeys = [], [], [], [], []
    feeds = []
    geometry = {'lines':[], 'alignments':[]}
    for source in catalog['feeds']:
        path = args.inputs / f'{source["id"]}.zip'
        raw = download(source['download']) if args.download else path.read_bytes()
        if args.download:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        feeds.append(ingest(source, raw, stops, routes, services, patterns, journeys, bounds, geometry))
    for place in catalog['places']:
        require(bounds[0] <= place['lat'] <= bounds[2] and bounds[1] <= place['lon'] <= bounds[3], 'Unexpected regional point')
        stops.append([place['id'],place['name'],'place',place['lat'],place['lon']])
    require(len({stop[0] for stop in stops}) == len(stops), 'Nonunique regional point IDs')
    start, end = max(feed['start'] for feed in feeds), min(feed['end'] for feed in feeds)
    require(start <= verified.strftime('%Y%m%d') <= end, 'At least one approved feed does not cover the review date')
    point_hash = hashlib.sha256(js_value(stops).encode()).hexdigest()
    if args.fetch_foot:
        durations, max_snap = make_walk_matrix(stops)
        foot = {'pointHash':point_hash,'builtOn':str(verified),'maxSnapMeters':max_snap,'durationSeconds':durations}
        if args.walk_cache:
            args.walk_cache.write_text(json.dumps(foot),encoding='utf-8')
    else:
        foot = json.loads(args.walk_cache.read_text())
        require(foot['pointHash'] == point_hash, 'Walking data needs regeneration because coordinates or order changed')
    unavailable = validate_walk(foot['durationSeconds'],len(stops))
    schedule = {'region':catalog['regionId'],'timezone':catalog['timezone'],'start':start,'end':end,
                'verified':str(verified),'pointHash':point_hash,'feeds':feeds,'points':[point[:3] for point in stops],
                'routes':routes,'services':services,'patterns':patterns,'journeys':journeys}
    geometry.update({'pointHash':point_hash,'stops':[point[3:] for point in stops]})
    report = {'mappedTrips':sum(j[-1] is not None for j in journeys),'region':catalog['regionId'],'reviewedOn':str(verified),'commonFrom':start,'commonUntil':end,
              'feeds':feeds,'points':len(stops),'patterns':len(patterns),'trips':len(journeys),
              'walking':{'builtOn':foot['builtOn'],'maxSnapMeters':foot['maxSnapMeters'],'unreachablePairs':unavailable}}
    if args.compare:
        previous = json.loads(args.compare.read_text())
        older = {item['id']:item for item in previous['feeds']}
        report['changes'] = [
            {field:[older.get(feed['id'], {}).get(field), feed[field]]
             for field in ('sha256','start','end','version','stops','trips','license')
             if older.get(feed['id'], {}).get(field) != feed[field]} | {'id':feed['id']}
            for feed in feeds
        ]
    if args.write:
        def write_js(path, value, notice):
            items = []
            for key,data in value.items():
                lines = '[\n'+',\n'.join('  '+js_value(item) for item in data)+'\n]' if isinstance(data,list) else js_value(data)
                items.append(f'  {json.dumps(key)}: {lines}')
            temporary = path.with_suffix('.tmp')
            temporary.write_text(f'// {notice}\nexport default {{\n'+',\n'.join(items)+'\n};\n',encoding='utf-8')
            temporary.replace(path)
        args.output_dir.mkdir(parents=True, exist_ok=True)
        write_js(args.output_dir/f'{slug}-schedule.js',schedule,'Approved GTFS snapshot. See docs/toyama-pilot.md for sources and licenses.')
        write_js(args.output_dir/f'{slug}-geometry.js',geometry,'Actual GTFS route shapes and stop positions. Same sources as the regional schedule.')
        write_js(args.output_dir/f'{slug}-walking.js',foot,'© OpenStreetMap contributors (ODbL). FOSSGIS OSRM pedestrian routing snapshot.')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog',type=Path,default=ROOT/'config'/'toyama-transit.json')
    parser.add_argument('--inputs',type=Path,required=True)
    parser.add_argument('--output-dir',type=Path,default=BROWSER_DATA)
    parser.add_argument('--as-of',default=date.today().isoformat())
    parser.add_argument('--download',action='store_true',help='Download the two reviewed GTFS sources')
    parser.add_argument('--fetch-foot',action='store_true',help='Refresh the small, rate-limited public walking snapshot')
    parser.add_argument('--walk-cache',type=Path,help='Cached walking output to write or reuse')
    parser.add_argument('--compare',type=Path,help='Review changes against an earlier JSON report')
    parser.add_argument('--write',action='store_true',help='Replace browser snapshots only after validation succeeds')
    args = parser.parse_args()
    if not args.fetch_foot and not args.walk_cache:
        parser.error('Use --walk-cache or explicitly choose --fetch-foot')
    try:
        print(json.dumps(generate(args),ensure_ascii=False,indent=2))
    except (ValueError, KeyError, OSError) as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False),file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
