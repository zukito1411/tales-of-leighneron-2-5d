"""Deterministic source-art extraction. Requires Pillow; never runs in the game."""
from pathlib import Path
from PIL import Image, ImageFilter
import argparse, json

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--sources',type=Path,default=root/'public/assets/sprites')
args=parser.parse_args()
# Source image pixel coordinates, independent of runtime sprite packing/trimming.
specs=[
 ('village-glass','buildings.png',(187,378,214,424),'opaque'),
 ('human-glass','capital_buildings.png',(610,315,640,355),'opaque'),
 ('inn-glass','buildings.png',(842,381,875,422),'opaque'),
 ('elven-small-glass','elven-villa.png',(103,314,119,360),'opaque'),
 ('elven-tree-glass','elven-villa.png',(552,200,591,265),'opaque'),
 ('palace-tree-glass','elven-villa.png',(1005,838,1109,926),'opaque'),
 ('shrine-glass','buildings.png',(222,787,265,873),'opaque'),
 ('elven-shrine-glass','elven-villa.png',(139,576,199,660),'opaque'),
 ('crown-banner','capital_buildings.png',(831,242,886,333),'opaque'),
 ('elven-banner','elven-villa.png',(847,223,897,319),'opaque'),
 ('inn-sign','buildings.png',(543,330,590,400),'opaque'),
 ('moss-slate','buildings.png',(534,172,572,220),'opaque'),
 ('door-leaf','elven-villa.png',(546,331,583,375),'foliage'),
 ('ivy','elven-villa.png',(495,196,521,351),'foliage'),
 ('flowers','elven-villa.png',(519,262,626,283),'foliage'),
 ('anvil-sign','buildings.png',(1049,344,1103,397),'opaque'),
]
canvas=Image.new('RGBA',(1024,1024))
manifest=[]
for i,(name,file,rect,mode) in enumerate(specs):
 im=Image.open(args.sources/file).convert('RGBA').crop(rect)
 if mode=='foliage':
  pixels=im.load()
  for y in range(im.height):
   for x in range(im.width):
    r,g,b,a=pixels[x,y]
    green=g>r*.88 and g>b*1.22 and g>45
    flower=min(r,g,b)>145 and max(r,g,b)-min(r,g,b)<85
    if not(green or flower):pixels[x,y]=(r,g,b,0)
  # Keep delicate leaf and petal edges soft only in this offline authoring pass.
  im.putalpha(im.getchannel('A').filter(ImageFilter.GaussianBlur(.35)))
 # The shader's sampling gutter is 3px. Extend edge pixels through that gutter.
 content=im.resize((248,248),Image.Resampling.LANCZOS)
 tile=Image.new('RGBA',(256,256))
 tile.paste(content,(4,4))
 tile.paste(content.crop((0,0,1,248)).resize((4,248)),(0,4))
 tile.paste(content.crop((247,0,248,248)).resize((4,248)),(252,4))
 tile.paste(tile.crop((0,4,256,5)).resize((256,4)),(0,0))
 tile.paste(tile.crop((0,251,256,252)).resize((256,4)),(0,252))
 canvas.paste(tile,((i%4)*256,(i//4)*256))
 manifest.append({'tile':i,'name':name,'source':'assets/sprites/'+file,'source_rect':list(rect),'alpha':mode})
out=root/'public/assets/presentation25d';out.mkdir(parents=True,exist_ok=True)
temporary=out/'source-building-details-v1.pending.png'
canvas.save(temporary,optimize=True)
with Image.open(temporary) as check: check.load()
temporary.replace(out/'source-building-details-v1.png')
(out/'source-building-details-v1.json').write_text(json.dumps({'size':[1024,1024],'grid':[4,4],'cells':manifest},indent=2)+'\n')
print(out/'source-building-details-v1.png')
