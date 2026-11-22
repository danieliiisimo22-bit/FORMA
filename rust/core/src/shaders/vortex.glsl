x+=(c-0.5)*1.7;
    y-=0.2*sin(s);
    float r=length(vec2(x,y));
    float theta=atan(y,x)+(2.0+a*13.0)*exp(-r*1.02);
    vec2 q=vec2(cos(theta),sin(theta))*r;
    float n=fbm(q*(1.2+k*5.0)+s);
    float ripple=0.5+0.5*sin(r*16.0+theta*3.0+b*12.0*n);
    return 0.12 + 0.59*n + (0.14+0.42*d)*pow(ripple,2.5)*exp(-r*0.55);
