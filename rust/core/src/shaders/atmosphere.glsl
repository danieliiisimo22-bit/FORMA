vec2 p=vec2(x,y);
    vec2 center=vec2(0.53*sin(s), b*1.6-0.8);
    vec2 q=(p-center)*vec2(0.61+a*0.71,1.03+a*0.9);
    float main=exp(-dot(q,q));
    q=(p+vec2(c*2.0-1.0,0.64))*vec2(0.69,1.64);
    float other=exp(-dot(q,q));
    float veil=fbm(p*(0.6+k*2.8)+s);
    return 0.06 + 0.61*main + 0.43*other - 0.28*main*other + (veil-0.49)*d*0.48;
