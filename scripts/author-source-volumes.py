"""Author closed reference-shaped volumes from retained artwork (offline only).

Only the Tree of Life depth survey is retained. Output is a small quantized
grid, never a new texture, animation, or runtime pixel scan.
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
path=ROOT/'public/assets/sprites/elarion-tree.png'
data={'lifeTree':volume(Image.open(path).convert('RGBA'),True),'sources':{str(path.relative_to(ROOT)):hashlib.sha256(path.read_bytes()).hexdigest()}}
(ROOT/'src/game/presentation25d/sourceVolumes.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
print('Authored Tree of Life volume; no textures changed.')
