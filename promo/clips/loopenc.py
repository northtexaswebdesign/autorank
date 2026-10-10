import sys, os, glob, subprocess
from PIL import Image
name, src, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
FPS, X = 60, 30  # 0.5 s crossfade
frames = sorted(glob.glob(f'{src}/f*.jpg'))
N = len(frames) - X
tmp = f'{src}_loop'; os.makedirs(tmp, exist_ok=True)
for k in range(N):
    u = k + X
    im = Image.open(frames[u]).convert('RGB')
    if u >= N:
        a = (u - N) / X
        a = a * a * (3 - 2 * a)
        im = Image.blend(im, Image.open(frames[u - N]).convert('RGB'), a)
    if k == 0: im.save(f'{outdir}/{name}-poster.jpg', quality=88)
    im.save(f'{tmp}/l{k:04d}.jpg', quality=95)
vf = 'scale=1600:-2:flags=lanczos,format=yuv420p'
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', f'{tmp}/l%04d.jpg', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-profile:v', 'high', '-movflags', '+faststart', '-an', f'{outdir}/{name}.mp4'], check=True)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', f'{tmp}/l%04d.jpg', '-vf', vf, '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an', f'{outdir}/{name}.webm'], check=True)
print(name, N, 'frames')
