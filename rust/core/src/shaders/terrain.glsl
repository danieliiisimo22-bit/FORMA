vec2 p=vec2(x,y)*(0.72+a*2.7)+s;
    float bend=fbm(p*0.72);
    float n=fbm(p+vec2(bend*b*3.6,bend*-b*2.8));
    n=clamp(n*0.75+0.23*exp(-dot(vec2(x,y),vec2(x,y))*0.39),0.0,1.0);
    float v=fract(n*(7.0+c*18.0+k*12.0));
    float ink=1.0-smoothstep(d*0.19,d*0.19+0.045,min(v,1.0-v));
    return 0.24+n*0.67-ink*0.32;
