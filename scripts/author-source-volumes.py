"""Author closed reference-shaped volumes from retained artwork (offline only).

Keeps complete horse strides and their shared scale/hoof baseline. Output is a
small quantized depth grid, never a new texture, animation, or runtime pixel scan.
"""
from pathlib import Path
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter, binary_closing, binary_fill_holes
import numpy as np, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
def volume(image, tree=False):
    n=64
    mask=np.array(image.resize((n,n),Image.Resampling.LANCZOS))[:,:,3]>72
    # A canopy is one coherent crown, not thousands of depth spikes at leaf holes.
    # Original transparency still supplies the detailed silhouette in the shader.
    envelope=binary_fill_holes(binary_closing(mask,iterations=2)) if tree else mask
    distance=distance_transform_edt(envelope)
    depth=(.020+(.13 if tree else .13)*np.sqrt(np.minimum(1,distance/(12 if tree else 7))))*envelope
    if tree:
        y=np.arange(n)[:,None]/(n-1)
        depth*=np.where(y<.58,1.0,np.where(y>.85,.45,.60))
    depth=gaussian_filter(depth,2.0 if tree else .85)
    depth[depth<.001]=0
    return {'size':n,'depth':[round(float(d)*4096) for d in depth.ravel()]}
def horse():
    path=ROOT/'public/assets/vehicles/horse-east-walk.png';im=Image.open(path).convert('RGBA');w,h=im.size;bounds=[]
    for i in range(4):
        cell=im.crop((i%2*w//2,i//2*h//2,(i%2+1)*w//2,(i//2+1)*h//2));yy,xx=np.nonzero(np.array(cell)[:,:,3]>64)
        bounds.append((cell,(int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1)))
    fit=min(236/max(b[2]-b[0] for _,b in bounds),160/max(b[3]-b[1] for _,b in bounds))
    top=252-max(b[3]-b[1] for _,b in bounds)*fit;poses=[]
    for cell,b in bounds:
        cr=cell.crop(b);width=(b[2]-b[0])*fit;height=(b[3]-b[1])*fit
        frame=Image.new('RGBA',(256,256));frame.alpha_composite(cr.resize((round(width),round(height)),Image.Resampling.BICUBIC),(round((256-width)/2),round(top)))
        poses.append(volume(frame))
    return poses
path=ROOT/'public/assets/sprites/elarion-tree.png'
data={'horse':horse(),'lifeTree':volume(Image.open(path).convert('RGBA'),True),'sources':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['public/assets/vehicles/horse-east-walk.png','public/assets/sprites/elarion-tree.png']}}
(ROOT/'src/game/presentation25d/sourceVolumes.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
print('Authored four complete horse poses and one tree volume; no textures changed.')
