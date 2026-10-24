"""Offline source swatch survey. Never runs during boot, streaming or animation.
Run node scripts/survey-prop-source-metadata.mjs first. Original images stay intact.
"""
from pathlib import Path
from PIL import Image,ImageDraw
from scipy.ndimage import label,find_objects
import numpy as np,json,re,tempfile
ROOT=Path(__file__).resolve().parents[1]
def patch(image,kind='wood'):
 a=np.array(image.convert('RGBA')).astype(float);h,w=a.shape[:2];q=max(7,round(min(w,h)*.065));best=None
 for y in range(round(h*.13),max(round(h*.14),h-q),max(2,q//3)):
  for x in range(round(w*.08),max(round(w*.09),w-q),max(2,q//3)):
   tile=a[y:y+q,x:x+q];r,g,b,alpha=[tile[:,:,i] for i in range(4)]
   if np.min(alpha)<230:continue
   light=(r+g+b)/3
   if kind=='wood':match=(r>g*1.10)&(g>b*1.14)&(r<g*1.95)&(light>42)&(light<180)
   elif kind=='stone':match=(np.max(tile[:,:,:3],2)-np.min(tile[:,:,:3],2)<65)&(light>60)&(light<200)
   else:match=(np.max(tile[:,:,:3],2)-np.min(tile[:,:,:3],2)>35)&(light>50)&(light<210)
   score=float(match.mean())*6-float(np.std(light))*.035-abs(float(light.mean())-115)*.003
   if best is None or score>best[0]:best=(score,[round(x/w,6),round(y/h,6),round((x+q)/w,6),round((y+q)/h,6)])
 if best:return best[1]
 yy,xx=np.nonzero(a[:,:,3]>230)
 if not len(xx):raise ValueError('Source subject contains no opaque material pixels')
 index=len(xx)//2;x=int(xx[index]);y=int(yy[index])
 return [x/w,y/h,(x+1)/w,(y+1)/h]
metadata=json.loads((Path(tempfile.gettempdir())/'leighneron-prop-sources.json').read_text())
world_path=ROOT/'src/game/presentation25d/worldPropMaterials.json';world=json.loads(world_path.read_text());swatches=[]
for key in world:
 texture,index=key.rsplit(':',1);index=int(index);sheet=metadata[texture]
 spec=sheet.get('sources',[None]*sheet.get('columns',32))[index] if sheet.get('sources') else None
 region=spec['cell'] if spec else sheet['regions'][index];path=spec.get('path',sheet['path']) if spec else sheet['path']
 image=Image.open(ROOT/'public'/path).convert('RGBA');size=spec.get('imageSize',sheet.get('sourceSize',image.size)) if spec else sheet.get('sourceSize',image.size)
 sx,sy=image.width/size[0],image.height/size[1];x,y,w,h=region
 crop=image.crop((round(x*sx),round(y*sy),round((x+w)*sx),round((y+h)*sy)))
 kind='stone' if texture in ['woodland_props','climate_props'] and index not in [4,5,9] or texture=='desert_props' and index in [4,5,11] or texture=='world_assets' and index==2 else 'wood'
 if texture in ['others','native_civic_bare'] and index in [1,3,6,10,13]:kind='stone'
 if texture in ['native_story_props','native_story_bare'] and index in [3,6,11]:kind='stone'
 if texture=='native_quest_landmarks' and index in [0,1,3,4]:kind='stone'
 if texture=='climate_props' and index in [2,6]:kind='color'
 if texture=='climate_props' and index in [5,9]:kind='stone'
 world[key]=patch(crop,kind);swatches.append((key,crop,world[key]))
world_path.write_text(json.dumps(world,separators=(',',':'))+'\n')
interior_path=ROOT/'src/game/presentation25d/furnitureMaterials.json';interior=json.loads(interior_path.read_text())
source=(ROOT/'src/data/interiorArt.ts').read_text();arts={k:tuple(map(int,v.split(','))) for k,v in re.findall(r'(\w+):\[([\d,]+)\]',source)}
for key in interior:
 kit,art=key.split(':');region=arts.get(art)
 if not region:continue
 image=Image.open(ROOT/'public/assets/interiors'/kit/'kit.png').convert('RGBA');x,y,w,h=region;crop=image.crop((x,y,x+w,y+h));a=np.array(crop)
 lab,num=label(a[:,:,3]>32);counts=np.bincount(lab.ravel());counts[0]=0;idx=counts.argmax();sl=find_objects(lab)[idx-1]
 crop=crop.crop((sl[1].start,sl[0].start,sl[1].stop,sl[0].stop));kind='stone' if art in ['hearth','arch','stairs','window'] else 'wood'
 interior[key]=patch(crop,kind)
 if kit in ['highmere_noble','narenthil_elven','trandum_rustic'] and art in ['chest','barrel','table','wardrobe','bookcase']:swatches.append((key,crop,interior[key]))
interior_path.write_text(json.dumps(interior,separators=(',',':'))+'\n')
# Inspection sheet only, outside the repository's runtime assets.
out=Image.new('RGB',(1000,90*((len(swatches)+7)//8)),(55,60,65));d=ImageDraw.Draw(out)
for i,(name,im,p) in enumerate(swatches):
 x=i%8*125;y=i//8*90;w,h=im.size;l,t,r,b=p;cr=im.crop((round(l*w),round(t*h),round(r*w),round(b*h))).resize((80,55));out.paste(cr,(x,y+30));d.text((x,y+2),name[:20],fill='white')
preview=ROOT/'.asset-review/source-material-surveys.jpg';preview.parent.mkdir(exist_ok=True);out.save(preview)
print('Surveyed original opaque material patches:',len(world),'world props and',len(interior),'room furnishings')
