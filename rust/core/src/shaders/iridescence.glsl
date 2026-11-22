x+=d-0.5;
    float scale=0.75+a*2.6;
    float f=sin(x*scale+(0.4+b*2.0)*sin(y*1.93+s));
    float g=cos(y*scale+(0.4+b*2.0)*sin(x*1.57-s));
    float angular=cos(atan(y,x)*3.0-length(vec2(x,y))*(2.0+k*5.0)+s);
    return 0.50 + f*0.28 + g*0.19*c + angular*0.18;
