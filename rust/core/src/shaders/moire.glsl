float f=12.0+a*36.0+k*13.0;
    float p=x*f+y*y*(2.1+c*12.0)+s;
    float q=x*(f+b*7.3)+y*(0.45+b*4.1)+cos(y*2.6+s)*(1.0+c*4.0);
    float beat=0.5+0.5*cos(p-q);
    float micro=cos(p)*0.5+cos(q)*0.5;
    return 0.48 + beat*(0.16+d*0.24) - micro*(0.12+(1.0-d)*0.30);
