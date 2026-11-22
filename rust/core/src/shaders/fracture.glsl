vec2 p=vec2(x,y)*0.74;
    float t=1.0;
    float stride=0.48+a*0.36;
    for(int i=0;i<6;i++){
      if(float(i)>2.0+k*4.0) break;
      p=abs(rot(p,0.14+b*0.78+s*0.033))-vec2(stride,0.36+d*0.36);
      t=min(t,abs(p.x)*pow(1.24,float(i)));
      p=p*1.29+vec2(0.11,-0.1);
    }
    return 0.13+0.61*exp(-t*(9.5+c*12.0))+0.15*cos(length(p)*6.0+s);
