float u=y+(d-0.5)*x+(0.27+a*0.83)*sin(x*1.55+s+0.32*y)+0.17*cos(x*3.0-y*1.2+s*0.65);
      float f=fract(u*(2.15-b*0.95+k*0.7)+s*0.21);
      float face=smoothstep(0.0,0.45,f)*(1.0-0.15*f);
      float shade=0.18+0.25*(0.5+0.5*sin(x*1.9-y*1.2+s));
      float edge=smoothstep(0.86,0.995,f);
      return 0.025+face*(0.40+shade)+edge*c*0.23;
