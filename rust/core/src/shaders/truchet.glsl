vec2 p=vec2(x,y)*(1.45+a*3.2+k*2.0)+vec2(0.37,0.62);
    vec2 cell=floor(p), f=fract(p);
    float h=hash(cell+floor(s*29.0));
    if(h<0.13+d*0.74) f.x=1.0-f.x;
    float edge=min(abs(length(f)-0.5),abs(length(1.0-f)-0.5));
    float width=0.046+b*0.124;
    float ribbon=1.0-smoothstep(width,width+0.016,edge);
    float stripe=1.0-smoothstep(width*0.19,width*0.37,edge);
    return mix(0.13,0.79-c*0.41*stripe,ribbon);
