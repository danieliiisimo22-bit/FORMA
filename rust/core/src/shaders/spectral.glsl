vec2 q=vec2((x+0.68-d*1.56)*(0.69+b*0.53),y+0.65+0.31*sin(s));
      float u=length(q)*(5.6+a*7.2+k*2.6)+0.83*sin(x*1.6-y*0.9+s)+s*0.41;
      float wave=pow(max(0.0,0.5+0.5*cos(u)),1.6+c*3.8);
      float light=exp(-0.21*dot(q-vec2(0.48,0.37),q-vec2(0.48,0.37)));
      return 0.045+light*(0.82*wave+0.115*(0.5+0.5*sin(u+x*2.17)));
