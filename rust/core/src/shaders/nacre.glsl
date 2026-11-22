float u=(y+(d-0.5)*x)*(1.8+a*3.1)+b*2.3*sin(x*1.71+s)+0.42*cos(y*1.88-x*2.3+s*0.7);
      float wave=sin(u+0.34*sin(u*2.0));
      float specular=exp(-abs(wave)*(8.0+k*10.0))*smoothstep(-0.4,0.55,cos(u));
      return 0.47+wave*0.31+0.12*sin(x*1.7-y*0.83+s)+specular*(0.1+c*0.37);
