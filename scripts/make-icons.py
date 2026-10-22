# Erzeugt die App-Icons (einmalig). Aufruf: python3 scripts/make-icons.py
from PIL import Image, ImageDraw
import os
GREEN=(47,125,91); CREAM=(246,245,242); OUT=os.path.join(os.path.dirname(__file__),'..','public')
def icon(size, maskable=False):
    s=4; S=size*s
    im=Image.new('RGBA',(S,S),GREEN if maskable else (0,0,0,0)); d=ImageDraw.Draw(im)
    if not maskable: d.rounded_rectangle([0,0,S-1,S-1],radius=int(S*0.22),fill=GREEN)
    k=0.78 if maskable else 1.0
    c=S/2
    def r(x0,y0,x1,y1,**kw):
        f=lambda v,o:c+(v-0.5)*S*k
        d.rounded_rectangle([f(x0,0),f(y0,0),f(x1,0),f(y1,0)],**kw)
    # Notizblock mit Haken-Zeilen
    r(0.24,0.20,0.76,0.82,radius=int(S*0.06*k),fill=CREAM)
    for i,y in enumerate([0.36,0.50,0.64]):
        r(0.31,y-0.035,0.38,y+0.035,radius=int(S*0.015*k),fill=GREEN)
        r(0.43,y-0.02,0.69 if i!=1 else 0.62,y+0.02,radius=int(S*0.02*k),fill=(170,190,180))
    # Ring oben
    r(0.40,0.15,0.60,0.25,radius=int(S*0.04*k),fill=(30,85,62))
    im=im.resize((size,size),Image.LANCZOS)
    return im
icon(192).save(os.path.join(OUT,'icon-192.png'))
icon(512).save(os.path.join(OUT,'icon-512.png'))
icon(512,True).save(os.path.join(OUT,'icon-maskable-512.png'))
print('icons ok')
