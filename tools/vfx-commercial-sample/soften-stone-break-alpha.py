from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/stone-break-edge'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'assets/vfx/earth/stone-break-sky-cast.png'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
a=np.array(Image.open(SOURCE).convert('RGBA')); b=a.copy()
assert a.shape==(1086,1448,4)
cell=362; band=24
x=np.arange(cell,dtype=float); d=np.minimum(x,cell-1-x)
t=np.clip(d/band,0,1); feather=t*t*(3-2*t)
records=[]
for frame in (7,8):
 row,col=divmod(frame-1,4); ys=slice(row*cell,(row+1)*cell); xs=slice(col*cell,(col+1)*cell)
 old=a[ys,xs,3]; alpha=old.astype(float)
 # Keep opaque solid rock untouched; progressively protect alpha160..224.
 q=np.clip((alpha-160)/64,0,1); protection=q*q*(3-2*q)
 factor=1-(1-feather[None,:])*(1-protection)
 new=np.rint(alpha*factor).astype(np.uint8)
 b[ys,xs,3]=new
 change=new!=old; yy,xx=np.where(change)
 records.append({'frame':frame,'changedAlphaPixels':int(change.sum()),'localChangeBboxInclusive':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())] if len(xx) else None,'maxAlphaReduction':int((old.astype(int)-new.astype(int)).max()),'opaqueAlphaAtLeast224Exact':bool(np.array_equal(new[old>=224],old[old>=224])),'coreX24Through337Exact':bool(np.array_equal(new[:,24:338],old[:,24:338]))})
assert np.array_equal(a[:,:,:3],b[:,:,:3])
assert np.all(b[:,:,3]<=a[:,:,3])
assert np.array_equal(b[:,:,3][a[:,:,3]==0],a[:,:,3][a[:,:,3]==0])
for frame in range(1,13):
 row,col=divmod(frame-1,4); orig=a[row*cell:(row+1)*cell,col*cell:(col+1)*cell]; cand=b[row*cell:(row+1)*cell,col*cell:(col+1)*cell]
 if frame not in (7,8): assert np.array_equal(orig,cand)
 else: assert np.array_equal(orig[:,24:338],cand[:,24:338])
png=OUT/'alpha-edge-candidate.png'; webp=OUT/'alpha-edge-candidate.webp'
Image.fromarray(b).save(png)
Image.fromarray(b).save(webp,format='WEBP',lossless=True,quality=100,method=6,exact=True)
assert np.array_equal(np.array(Image.open(png).convert('RGBA')),b)
assert np.array_equal(np.array(Image.open(webp).convert('RGBA')),b)
report={'source':str(SOURCE),'sourceSha256':sha(SOURCE),'script':str(Path(__file__).resolve()),'scriptSha256':sha(Path(__file__)),'candidatePng':str(png),'candidatePngSha256':sha(png),'candidateWebp':str(webp),'candidateWebpSha256':sha(webp),'dimensions':[1448,1086],'grid':[4,3],'frames':12,'cell':[362,362],'method':'Only frames7/8 left/right24px: original alpha multiplied by smoothstep(distance/24), with solid alpha160..224 progressively protected; alpha>=224 untouched. RGB is never edited. No scale/crop/trim/regrid.','framesChanged':records,'assertions':{'allRGBExact':True,'otherTenFramesAllRGBAExact':True,'centerCoreAtLeast24pxFromSidesAllRGBAExact':True,'opaqueRockAlphaAtLeast224Exact':True,'originalTransparentPaddingRetained':True,'alphaNeverIncreased':True,'webpDecodedRGBAEqualsPngAndCandidate':True},'status':'ISOLATED_CANDIDATE_NOT_RUNTIME_APPROVED','limitations':['Local source edit only; phone replay and independent review required.','No promise that24px feather removes every internal rectangular haze boundary.']}
(OUT/'alpha-edge-candidate.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
