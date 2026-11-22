y += (0.16 + a*0.55)*sin(x*(1.25+b*1.4)+s) + 0.17*cos(x*3.1-s*0.7);
    x += 0.24*sin(y*3.4 + s*0.5);
    float q = (y + 0.23*sin(x*2.8+y*3.9+s) + 0.16*sin(x*3.2-y*2.7-s))*1.2;
    float folds = cos(q*(7.2+k*8.0) + x*(1.12+d) + 1.1*sin(x*2.25+y*1.7));
    float body = exp(-pow(abs(y)*(1.30+0.74*b),2.0)-pow(abs(x)*0.42,4.0));
    float light = (0.39 + 0.52*pow(0.5+0.5*folds,1.58))*body;
    float lines = sin(q*(120.0+c*143.0) + x*13.0 + 7.0*sin(y*3.1+x));
    float satin = 0.5+0.5*sin(x*2.4-y*3.2+s);
    return 0.033 + light*(0.72+0.32*satin) + lines*(0.014+0.044*body) + 0.036*sin(q*26.0-x*3.0)*body;
