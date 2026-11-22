vec2 p=rot(vec2(x,y),(b-0.5)*1.05)*(1.1+a*3.2+k*1.7);
    vec2 grid=vec2(p.x-p.y/1.7320508,p.y*2.0/1.7320508);
    vec2 cell=floor(grid), f=fract(grid);
    float face=step(1.0,f.x+f.y);
    f=mix(f,1.0-f,face);
    float edge=min(min(f.x,f.y),1.0-f.x-f.y);
    float h=hash(cell+vec2(floor(s*13.0),face*23.0));
    float tone=0.18+face*0.28+h*0.22+d*0.28*(1.0-f.x-f.y);
    return mix(0.07,tone,smoothstep(c*0.075,c*0.075+0.013,edge));
