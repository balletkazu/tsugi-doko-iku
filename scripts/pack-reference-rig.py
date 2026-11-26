#!/usr/bin/env python3
"""Pack five authored views per row, from the full size production contact sheets.

Run with Pillow, NumPy and SciPy. The browser gets transparent WebP, separate
material coverage, feature pigments, and landmarks. No development packages
are required to build the app.
"""
from argparse import ArgumentParser
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_fill_holes, distance_transform_edt, gaussian_filter, label

ROOT = Path(__file__).resolve().parents[1] / "public"
CELL = 256
# Coordinates on the original 1619×971 head source, in view order.
# pivot, left/right eyes, mouth, ear piercings, and the skin/hair boundary.
HEADS = [
    [(179,279),[(142,193),(228,192)],(182,244),[(89,239),(270,238)],
     [(57,214),(74,200),(97,201),(103,183),(131,169),(156,158),(176,155),(193,145),(207,111),(221,99),(241,114),(247,136),(252,174),(258,198),(276,200),(294,213),(289,239),(259,251),(235,279),(189,288),(149,288),(109,260),(75,253)]],
    [(499,279),[(528,193),(596,192)],(565,244),[(442,238)],
     [(415,209),(437,193),(455,195),(470,202),(473,181),(493,166),(522,157),(546,156),(568,143),(580,107),(597,129),(607,152),(616,185),(620,211),(620,240),(601,272),(576,289),(523,289),(484,262),(446,257),(415,234)]],
    [(818,278),[(902,194)],(910,246),[(817,221)],
     [(793,205),(805,187),(820,180),(838,196),(853,183),(869,158),(895,129),(913,127),(933,148),(944,182),(939,210),(949,235),(932,278),(878,296),(803,297),(802,263),(794,244)]],
    [(1138,274),[],None,[(1211,223)],
     [(1122,287),(1140,265),(1164,264),(1182,235),(1193,207),(1204,187),(1224,182),(1238,171),(1247,194),(1251,232),(1233,263),(1195,277),(1158,283),(1154,294)]],
    [(1455,276),[],None,[(1358,232),(1543,230)],
     [(1337,206),(1352,201),(1365,207),(1374,237),(1389,250),(1337,253),(1334,219),(1337,206),
      (1520,246),(1535,218),(1547,200),(1564,198),(1571,243),(1515,256)]],
    [(174,586),[(142,503),(227,501)],(184,551),[(88,540),(270,540)],
     [(70,504),(86,497),(98,499),(105,473),(113,461),(127,452),(147,445),(151,463),(163,470),(169,470),(174,453),(181,471),(205,474),(211,450),(237,450),(251,466),(258,502),(272,495),(292,508),(293,534),(276,548),(254,553),(238,577),(194,595),(167,598),(132,579),(107,552),(83,552),(68,532)]],
    [(502,583),[(530,500),(597,496)],(565,550),[(437,537)],
     [(411,506),(425,490),(443,490),(456,501),(467,493),(485,467),(509,454),(535,450),(545,454),(546,469),(556,473),(565,461),(574,475),(584,468),(590,448),(608,446),(620,466),(625,508),(628,549),(600,578),(565,595),(524,592),(498,584),(488,567),(465,551),(430,552),(409,535)]],
    [(821,584),[(902,502)],(912,550),[(818,536)],
     [(791,507),(799,490),(819,487),(832,490),(842,487),(855,474),(873,455),(886,446),(902,445),(906,459),(928,452),(938,466),(939,501),(947,524),(926,562),(913,582),(879,595),(859,590),(849,560),(831,558),(809,553),(789,541)]],
    [(1135,585),[],None,[(1215,522)],
     [(1189,517),(1199,492),(1213,490),(1222,497),(1234,481),(1241,471),(1251,478),(1250,512),(1259,545),(1233,578),(1201,593),(1193,577),(1199,548)]],
    [(1455,583),[],None,[(1336,526),(1566,523)],
     [(1324,499),(1344,497),(1345,521),(1345,545),(1331,547),(1323,533),(1324,499),
      (1557,505),(1575,495),(1581,519),(1574,541),(1559,549),(1560,529)]],
    [(178,919),[(140,830),(229,830)],(181,885),[(85,866),(269,861)],
     [(63,837),(81,827),(95,833),(102,812),(109,785),(120,757),(136,739),(169,727),(198,721),(229,730),(247,754),(254,777),(259,813),(264,830),(284,823),(296,847),(286,872),(263,884),(241,909),(198,932),(159,935),(121,914),(100,883),(76,881),(58,857)]],
    [(505,917),[(530,829),(596,829)],(564,883),[(437,862)],
     [(414,840),(433,825),(450,832),(467,830),(478,798),(496,771),(516,749),(543,733),(568,723),(592,735),(607,755),(616,784),(617,817),(621,845),(617,874),(601,902),(572,932),(525,931),(476,902),(442,887),(420,882)]],
    [(816,918),[(902,830)],(912,881),[(818,857)],
     [(789,838),(801,817),(818,812),(837,822),(855,814),(866,784),(884,752),(899,729),(914,739),(932,757),(936,781),(937,820),(943,850),(936,877),(920,902),(872,915),(856,932),(802,939),(782,927),(795,885),(794,864)]],
    [(1138,916),[],None,[(1212,867)],
     [(1091,923),(1111,907),(1145,897),(1174,876),(1185,847),(1201,820),(1219,819),(1234,794),(1247,778),(1249,819),(1250,859),(1243,894),(1211,919),(1170,921),(1145,930)]],
    [(1455,917),[],None,[(1362,866),(1545,864)],
     [(1335,829),(1356,830),(1374,848),(1370,869),(1387,895),(1357,896),(1336,879),(1331,852),(1335,829),
      (1515,891),(1535,854),(1546,831),(1564,830),(1575,851),(1572,881),(1533,897),(1502,921),(1435,935),(1411,922),(1399,899),(1437,911),(1480,913)]],
]

# The small pair of ears on a rear drawing are disconnected shapes.
REAR_SPLITS={4:(8,),9:(7,),14:(9,)}


def keyed(image):
    rgb = np.asarray(image.convert("RGB")).astype(float)
    r, g, b = np.moveaxis(rgb, -1, 0)
    excess = g - np.maximum(r, b)
    alpha = np.clip(1 - (excess - 9) / 66, 0, 1)
    # Key pixels near a painted contour may retain green after downsampling.
    rgb[:, :, 1] = np.minimum(g, np.maximum(r, b) + 9)
    return Image.fromarray(np.dstack((rgb, alpha * 255)).clip(0, 255).astype("uint8"))


def cells(path, rows, x_edges=None, y_edges=None):
    art = keyed(Image.open(path))
    xs = x_edges or [round(art.width*k/5) for k in range(6)]
    ys = y_edges or [round(art.height*k/rows) for k in range(rows+1)]
    for row in range(rows):
        for col in range(5):
            left, top = xs[col], ys[row]
            tile = art.crop((left, top, xs[col+1], ys[row+1]))
            visible = tile.getchannel("A").point(lambda a: 255 if a>150 else 0).getbbox()
            if not visible:
                raise ValueError(f"Empty cell {row} {col} in {path}")
            x0, y0, x1, y1 = visible
            if min(x0, y0, tile.width-x1, tile.height-y1)<2:
                raise ValueError(f"Adjacent cell art touches {row} {col} in {path}: {visible}")
            # Do not enlarge an original crop. Keep two pixels of translucent edge.
            edges=(x0-2,y0-2,x1+2,y1+2)
            sprite=tile.crop(edges)
            scale=min(1,(CELL-4)/max(sprite.size))
            yield sprite, (left+edges[0],top+edges[1]), scale


def ellipse(x, y, rx, ry, box):
    yy, xx = np.ogrid[:box[1], :box[0]]
    return ((xx-x)/rx)**2+((yy-y)/ry)**2


def matte(region, softness=1.3):
    return np.clip(.5+(distance_transform_edt(region)-distance_transform_edt(~region))/(2*softness),0,1)


def sprite_head(sprite,origin,scale,index):
    pivot, eyes, mouth, ears, boundary=HEADS[index]
    local=lambda point:(point[0]-origin[0],point[1]-origin[1])
    regions=Image.new('1',sprite.size)
    pen=ImageDraw.Draw(regions)
    edges=[0,*REAR_SPLITS.get(index,[]),len(boundary)]
    for lo,hi in zip(edges,edges[1:]):
        pen.polygon([local(point) for point in boundary[lo:hi]],fill=1)
    rgba=np.asarray(sprite).copy()
    rgb=rgba[:,:,:3].astype(float)
    alpha=rgba[:,:,3]>30
    raw=np.asarray(regions)&alpha
    red,green,blue=np.moveaxis(rgb,-1,0)
    score=.78*green+.22*blue-.28*(red-green)
    # The outline is authored. Refine the edge only for strong evidence and
    # never include detached bright paint or the original key background.
    near=(distance_transform_edt(~raw)<=7)&(score>163)&alpha
    groups,_=label(raw|near)
    indices=np.unique(groups[raw])
    skin=binary_fill_holes(np.isin(groups,indices[indices!=0]))&alpha
    safe=distance_transform_edt(skin)>3
    marks=np.zeros(skin.shape,dtype=float)
    if eyes:
        parts=[(local(p),16,23) for p in eyes]
        parts.extend(((x-1,y-38),34,15) for ((x,y),_,_) in parts[:len(eyes)])
        x,y=local(mouth)
        parts.append(((x,y),24,10))
        parts.append(((x+(8 if index%5==1 else 0),y-29),11,17))
        for (x,y),rx,ry in parts:
            marks=np.maximum(marks,np.clip((1.3-ellipse(x,y,rx,ry,sprite.size))*3,0,1))
    area=(marks>.02)&safe
    base=rgb.copy()
    if area.any():
        # Interpolate exclusively from clear skin; isolate only the strokes
        # from the original, with soft edges when aligned over a new color.
        support=skin&~area
        for c in range(3):
            for sigma in (5,12,22):
                weight=gaussian_filter(support.astype(float),sigma)
                values=gaussian_filter(base[:,:,c]*support,sigma)
                valid=area&(weight>.02)
                base[:,:,c][valid]=values[valid]/weight[valid]
        loss=(base-rgb).mean(axis=2)
        ink=np.clip((loss-10)/82,0,1)*marks*safe
        # Keep the paper grain around the native brushstrokes. Interpolate
        # only where a feature (or the highlight inside an eye) was painted.
        feature=np.clip((np.abs(loss)-5)/15,0,1)*marks*safe
        base=rgb*(1-feature[:,:,None])+base*feature[:,:,None]
    else:
        ink=np.zeros(skin.shape)
    rgba[:,:,:3]=np.round(base).clip(0,255).astype("uint8")
    pigment=np.empty_like(rgba)
    pigment[:,:,:3]=[77,45,27]
    pigment[:,:,3]=np.round(ink*255)
    coverage=matte(skin)
    hair=np.where(alpha,1-coverage,0)
    # Long loose locks also need a back layer behind the collar and straps.
    yy,xx=np.ogrid[:sprite.height,:sprite.width]
    px,py=local(pivot)
    loose=((yy-py)>-31)&((abs(xx-px)>35) if index%5 in (0,1) else xx<px+5) if 5<=index<10 and index%5<3 else np.zeros_like(alpha)
    back=hair if index%5>=3 else hair*matte(loose&alpha) if loose.any() else np.zeros_like(hair)
    masks=np.stack((hair-back,coverage,back,np.ones_like(back)),axis=2)
    resize=lambda p:[round(v*scale,2) for v in local(p)]
    guides=[resize(pivot),[resize(p) for p in eyes],resize(mouth) if mouth else None,[resize(p) for p in ears]]
    return Image.fromarray(rgba),Image.fromarray(np.round(masks*255).astype('uint8')),Image.fromarray(pigment),guides


def unembroidered(sprite):
    # The beret has embroidery on only one temple. The opposite-facing
    # cell carries continuous wool in that area, with the same silhouette.
    arr=np.asarray(sprite).copy()
    r,g,b,a=np.moveaxis(arr.astype(float),-1,0)
    yy,xx=np.ogrid[:sprite.height,:sprite.width]
    area=(xx>sprite.width*.50)&(yy>sprite.height*.32)&(yy<sprite.height*.81)
    stitch=area&(a>200)&(g>107)&(g-b>24)&(r-g<90)
    soften=gaussian_filter(stitch.astype(float),1.6)
    mask=np.clip(soften*4,0,1)
    mirrored=np.flip(arr,axis=1)
    donor=(mirrored[:,:,3]>210)
    blend=(mask*donor)[:,:,None]
    arr[:,:,:3]=np.round(arr[:,:,:3]*(1-blend)+mirrored[:,:,:3]*blend)
    return Image.fromarray(arr)


def pack(kind,path,rows,destination):
    pictures=Image.new('RGBA',(CELL*5,CELL*(rows+int(kind=='hats'))))
    masks=Image.new('RGBA',pictures.size,(0,0,0,255))
    inks=Image.new('RGBA',pictures.size)
    guides=[]
    atlas_edges={'heads':([0,341,665,973,1290,1619],[0,313,626,971]),
                 'gear':(None,[0,372,652,971])}
    x_edges,y_edges=atlas_edges.get(kind,(None,None))
    for index,(sprite,origin,scale) in enumerate(cells(path,rows,x_edges,y_edges)):
        pos=(index%5*CELL,index//5*CELL)
        geometry=[]
        size=tuple(round(d*scale) for d in sprite.size)
        if kind=='heads':
            sprite,mask,marks,geometry=sprite_head(sprite,origin,scale,index)
            masks.paste(mask.resize(size,Image.Resampling.BILINEAR),pos)
            inks.paste(marks.resize(size,Image.Resampling.LANCZOS),pos)
        elif kind=='clothes':
            source=np.asarray(sprite).astype(float)
            r,g,b,a=np.moveaxis(source,-1,0)
            cloth=a>20
            if index in (5,6):
                # The shirt opening under the yellow jacket is its own cloth.
                yy,xx=np.ogrid[:sprite.height,:sprite.width]
                center=sprite.width*(.5 if index==5 else .7)
                cloth &= ~((abs(xx-center)<sprite.width*.11)&(r-b<95)&(g>152))
            values=np.zeros(source.shape,dtype='uint8')
            values[:,:,2]=np.round(matte(cloth)*255)
            values[:,:,3]=255
            masks.paste(Image.fromarray(values).resize(size,Image.Resampling.BILINEAR),pos)
        sprite=sprite.resize(size,Image.Resampling.LANCZOS)
        pictures.paste(sprite,pos)
        guides.append([size,*geometry])
        if kind=='hats' and index in (16,17):
            bare=unembroidered(sprite)
            pictures.paste(bare,((index-16)*CELL,4*CELL))
    if kind=='hats':
        guides.extend(guides[index] for index in (16,17))
    pictures.save(destination/(kind+'.webp'),quality=92,method=6)
    if kind in ('heads','clothes'):
        masks.save(destination/(kind+'-material.webp'),lossless=True,method=6)
    if kind=='heads':
        inks.save(destination/(kind+'-features.webp'),quality=90,method=6)
    return guides


if __name__=='__main__':
    parser=ArgumentParser(description=__doc__)
    for name in ('heads','clothes','gear','hats'):
        parser.add_argument(name,type=Path)
    args=parser.parse_args()
    target=ROOT/'assets'/'rig'
    target.mkdir(exist_ok=True)
    guide={name:pack(name,getattr(args,name),4 if name=='hats' else 3,target) for name in ('heads','clothes','gear','hats')}
    (ROOT/'reference-guides.js').write_text('// Art registration in 256 px atlas cells. Generated by scripts/pack-reference-rig.py.\n'
        +'export const referenceGuides='+json.dumps(guide,separators=(',',':'))+';\n')
