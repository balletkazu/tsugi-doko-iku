#!/usr/bin/env python3
"""Publish source-derived component masks and audited sprite anchors.

Run with Python, Pillow, NumPy and SciPy. Chromakey sources are lossless when
importing a new set. Generated material maps are lossless RGBA WebP.
Red = hair, green = skin, blue = fabric, alpha always 255.
"""
from pathlib import Path
import json
import runpy

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_closing, binary_fill_holes, distance_transform_edt, label

ROOT = Path(__file__).resolve().parents[1] / "public"
ATELIER = ROOT / "assets" / "atelier"
CATALOG = ROOT / "assets" / "catalog"
legacy = runpy.run_path(str(Path(__file__).with_name("prepare-avatar-layers.py")))
FRONT, PROFILE, cell = (legacy[key] for key in ("FRONT", "PROFILE", "cell"))
Y, X = np.ogrid[:128, :128]

# After the source sheets are normalized, landmarks describe actual faces.
ANCHORS = Path(__file__).parent / "material-anchors.json"


def ellipse(x, y, rx, ry):
    return ((X - x) / rx) ** 2 + ((Y - y) / ry) ** 2 <= 1


def source_box(image):
    box = image.getchannel("A").point(lambda a: 255 if a > 155 else 0).getbbox()
    if not box or box[0] < 4 or box[2] > 124 or box[1] < 4 or box[3] > 125:
        raise ValueError(f"Invalid source crop {box}")
    return box


def connected(candidate, seed):
    groups, _ = label(candidate)
    selected = np.unique(groups[seed & candidate])
    return np.isin(groups, selected[selected != 0])


def feather(region, width=1.45):
    inner = distance_transform_edt(region)
    outer = distance_transform_edt(~region)
    return np.clip(.5 + (inner - outer) / (2 * width), 0, 1)


def facial_marks(points, view, traced):
    if view == "side":
        eye, ey, mouth, my = points
        marks = ellipse(eye, ey, 4.5, 7.3) | ellipse(mouth, my, 4.3, 3.3)
        brows = ellipse(eye-1, ey-(15 if traced else 7), 7 if traced else 5.4, 4.9 if traced else 3.5)
        return marks, brows, (eye-10, ey+2, 39, 34), (eye-1,ey+7)
    left,right,ey,my = points[:4]
    mid = (left+right)/2
    mouth = points[4] if len(points)>4 else mid
    marks = (ellipse(left,ey,5.9,7.2) | ellipse(right,ey,5.9,7.2)
             | ellipse(mouth,my,8.5,4.2) | ellipse(mouth+1,my-7,3.4,3))
    gap, width, height = (16,8.2,5.2) if traced else (8,6,3.7)
    brows = ellipse(left,ey-gap,width,height) | ellipse(right,ey-gap,width,height)
    return marks,brows,(mid,ey+1,(right-left)/2+25,35),(mid,ey+9)


def traced_regions(polygons, alpha):
    plane=Image.new('1',(128,128))
    draw=ImageDraw.Draw(plane)
    for points in polygons:
        draw.polygon([tuple(point) for point in points],fill=1)
    return np.array(plane)&alpha


def face_regions(image, points, view, adjustment=None, trace=None):
    src = np.array(image).astype(float)
    alpha = src[:,:,3] / 255
    rgb = src[:,:,:3]
    red,green,blue = np.moveaxis(rgb,-1,0)
    marks,brows,pose,seed_pos = facial_marks(points,view,trace is not None)
    # Bright skin and the warm ear shadows form a connected region. Individual
    # hairlines can be corrected with polygons (coordinates in source pixels).
    color_score = .72*green + .28*blue - .29*(red-green)
    shape = ellipse(*pose)
    opaque = alpha>.25
    seed=ellipse(*seed_pos,17,11)
    inner = connected(binary_closing((color_score>158)&shape&opaque,iterations=2) | (marks & shape & opaque),seed)
    edge = (color_score>128) & (distance_transform_edt(~inner)<4) & shape & opaque
    skin = binary_fill_holes(connected(inner|edge,seed))
    if trace is not None:
        traced=traced_regions(trace,opaque)
        # Expand only to a contiguous lit area next to the drawn hairline.
        # The lower face stays on the authored contour, including warm shadows.
        correction=(Y<seed_pos[1]-11)&(distance_transform_edt(~traced)<=10)
        lit=connected(((color_score>150)&correction&opaque)|traced,traced)
        skin=traced | lit
    if adjustment:
        for action,points in adjustment.items():
            plane=Image.new('1',(128,128))
            ImageDraw.Draw(plane).polygon([tuple(p) for p in points], fill=1)
            region=np.array(plane)&opaque
            skin = (skin|region) if action=='skin' else (skin&~region)
    skin &= opaque
    # Remove the source expression only inside the same skin mask.
    allowed = distance_transform_edt(skin)>1.5
    target = (marks | (brows & (color_score<191))) & allowed
    donors = skin & ~target & (color_score>140)
    yy,xx=np.nonzero(donors)
    colors=rgb[yy,xx].copy()
    if len(yy)<35:
        raise ValueError(f"Not enough skin at {view} {points}")
    for y,x in zip(*np.nonzero(target)):
        dist=(xx-x)**2+(yy-y)**2
        near=np.argpartition(dist,8)[:8]
        rgb[y,x]=np.average(colors[near],axis=0,weights=1/(dist[near]+2))
    coverage=feather(skin,1.12 if trace else 1.45)
    hair = np.where(alpha>0,1-coverage,0)
    return Image.fromarray(src.clip(0,255).astype('uint8')), channels(hair,coverage,None), skin


def channels(hair=None,skin=None,fabric=None):
    image=np.zeros((128,128,4),dtype='uint8')
    image[:,:,3]=255
    for i,plane in enumerate((hair,skin,fabric)):
        if plane is not None: image[:,:,i]=np.round(plane*255).astype('uint8')
    return Image.fromarray(image)


def normal_outfit(image,sheet,index):
    base=np.array(image).astype(float)
    r,g,b,a=np.moveaxis(base,-1,0)
    left,top,right,end=source_box(image)
    fraction=(Y-top)/(end-top)
    if sheet=='garments':
        cloth_end=[.59,.55,.82,.56,.58,.70,.60,.87][index]
        has_ankle=index in [1,7]
    elif sheet=='wardrobe':
        cloth_end=[.58,.60,.80,.55][index//4]
        has_ankle=index//4 in [0,1]
    else:
        cloth_end=[.55,.61,.55,.61][index//4]
        has_ankle=False
    # Material roles are exclusive. Small visible ankle areas have a
    # separate documented window, so boots and socks preserve their pigment.
    skin=((fraction>.79)&(fraction<.96)&(abs(X-(left+right)/2)<(right-left)*.37)
          &(a>55)&(g>126)&(r-g>11)&(r-g<68)&(g-b>14)&(g-b<66)) if has_ankle else np.zeros_like(a,dtype=bool)
    cloth=(fraction<cloth_end)&(a>40)&~skin
    if sheet=='atelier-towns':
        # The exposed shirt/inner collar remains its original fabric color.
        # The pigment map for the outer layer stops at the lapel seam.
        direction=index%4
        opening=(abs(X-(64 if direction==0 else 75))<10)&(fraction<.54)
        lining=(g>104)&(r-b>16)&(r-g>6)
        if direction not in (2,3):
            cloth &= ~(opening & lining)
    return channels(None,feather(skin) if skin.any() else skin,feather(cloth))


def ear_points(skin, points, view):
    if view == 'side':
        eye,ey=points[:2]
        targets=[(eye-34,ey+12)]
    else:
        left,right,ey=points[:3]
        targets=[(left-23,ey+12)] if view=='oblique' else [(left-23,ey+11),(right+23,ey+11)]
    ears=[]
    for x,y in targets:
        region=(np.abs(X-x)<=10)&(np.abs(Y-y)<=7)
        yy,xx=np.nonzero(skin&region)
        if len(xx)<13:
            continue
        best=np.argmin((xx-x)**2+(yy-y)**2)
        ears.append([int(xx[best]),int(yy[best])])
    return ears

def save_pair(name,sheet,material,where):
    sheet.save(where/(name+'.webp'),quality=93,method=6)
    material.save(where/(name+'-map.webp'),lossless=True,method=6)


def main():
    config=json.loads(ANCHORS.read_text())
    CATALOG.mkdir(exist_ok=True)
    guides={}

    def heads(name,faces,where):
        height=((len(faces)+3)//4)*128
        base=Image.new('RGBA',(512,height))
        masks=Image.new('RGBA',base.size,(0,0,0,255))
        for slot,(image,view,points,manual_key) in enumerate(faces):
            box=source_box(image)
            x,y=slot%4*128,slot//4*128
            trace=config.get('skin-shapes-'+manual_key[0],[])[int(manual_key[2:])] if manual_key[1]=='-' else None
            if view=='back':
                red,green,blue,alpha=np.moveaxis(np.array(image).astype(float),-1,0)
                ready=image
                if trace is not None:
                    skin=traced_regions(trace,alpha>40)
                elif manual_key.startswith('heads-back'):
                    skin=np.zeros_like(alpha,dtype=bool)
                else:
                    skin=(.72*green+.28*blue-.29*(red-green)>157)&(alpha>40)&(Y>69)
                    skin= binary_fill_holes(binary_closing(skin,iterations=1))
                coverage=feather(skin) if skin.any() else np.zeros_like(alpha)
                mask=channels(np.where(alpha>0,1-coverage,0),coverage)
            else:
                ready,mask,skin=face_regions(image,points,view,config.get('polygons',{}).get(manual_key),trace)
                if np.count_nonzero(skin)<280: raise ValueError(f"Unexpected skin area {name} {slot}")
            base.paste(ready,(x,y));masks.paste(mask,(x,y))
            guides.setdefault(name,[]).append([box,points,ear_points(skin,points,view) if points else []])
        save_pair(name,base,masks,where)

    faces=[]
    for source,view,anchors in [('heads','front',FRONT),('heads-profile','side',PROFILE),('heads-back','back',[None]*16)]:
        src=Image.open(ATELIER/(source+'.webp')).convert('RGBA')
        faces.extend((cell(src,i)[2],view,points,f'{source}-{i}') for i,points in enumerate(anchors))
    heads('head-core',faces,ATELIER)
    for key in ('a','b'):
        sheet=Image.open(CATALOG/('heads-cuts-'+key+'.webp')).convert('RGBA')
        faces=[(cell(sheet,i)[2],['front','side','back','oblique'][i%4],points,f'{key}-{i}')
               for i,points in enumerate(config['cuts-'+key])]
        heads('head-cuts-'+key+'-v1',faces,CATALOG)

    for name,count,where in [('garments',8,ATELIER),('wardrobe',16,ATELIER),('atelier-towns',16,CATALOG)]:
        source=Image.open(where/(name+'.webp')).convert('RGBA')
        masks=Image.new('RGBA',source.size,(0,0,0,255))
        for i in range(count):
            x,y,body=cell(source,i)
            guides.setdefault(name,[]).append(source_box(body))
            masks.paste(normal_outfit(body,name,i),(x,y))
        masks.save(where/(name+'-map.webp'),lossless=True,method=6)

    for name,count in [('local-crafts',9),('home-crafts',4)]:
        source=Image.open(CATALOG/(name+'.webp')).convert('RGBA')
        guides[name]=[source_box(cell(source,i)[2]) for i in range(count)]

    (ROOT/'material-guides.js').write_text('// Generated by scripts/prepare-materials.py. Art boxes and landmarks in 128 px cells.\n'
        +'export const materialGuides = '+json.dumps(guides,separators=(',',':'))+';\n')


if __name__=='__main__':
    main()
