"""Package shipping bytes unchanged. Run AFTER web build, BEFORE cap sync."""
import hashlib,json,zipfile
from pathlib import Path
root=Path('dist');out=Path('asset-packs');groups={};files={}
for name in json.loads((out/'inventory.json').read_text()):
 p=root/name
 if not p.is_file():raise RuntimeError('Missing shipping asset: '+name)
 digest=hashlib.sha256(p.read_bytes()).hexdigest()
 files[name]={'hash':digest,'bytes':p.stat().st_size}
 groups.setdefault(digest[:2],{})[digest]=p
packs=[]
for bucket,entries in sorted(groups.items()):
 temporary=out/(bucket+'.tmp')
 with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
  for digest,p in sorted(entries.items()):
   info=zipfile.ZipInfo(digest,date_time=(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
   archive.writestr(info,p.read_bytes(),compresslevel=6)
 digest=hashlib.sha256(temporary.read_bytes()).hexdigest();target=out/(digest+'.zip');temporary.replace(target)
 packs.append({'hash':digest,'bytes':target.stat().st_size,'files':list(sorted(entries))})
manifest={'version':1,'baseUrl':'https://github.com/zukito1411/tales-of-leighneron-2-5d/releases/download/leighneron-assets-v1/','files':files,'packs':packs}
(root/'native-assets.json').write_text(json.dumps(manifest,separators=(',',':')))
# Remove only the exact public inventory. Never match generated JS by extension
# or remove source masters from public/. Desktop/browser builds remain complete.
for name in files:(root/name).unlink()
print('Download assets:',len(files),'files;',sum(p['bytes'] for p in packs),'compressed bytes;',len(packs),'packs')
