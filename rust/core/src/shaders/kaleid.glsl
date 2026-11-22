float r=length(vec2(x,y));
    float angle=atan(y,x);
    float petals=cos(angle*floor(4.0+a*13.0)+s*0.35);
    float f=r*(5.0+k*11.0)+petals*b*1.12;
    float rings=0.5+0.5*cos(f*2.0);
    float leaf=0.5+0.5*cos(angle*floor(4.0+a*13.0)+s*0.35-r*2.7);
    float envelope=1.0-smoothstep(0.42+d*0.33,0.63+d*0.33,r);
    return 0.05 + (0.21+0.46*pow(rings,1.5)+c*0.37*leaf)*envelope;
