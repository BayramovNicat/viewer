(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))c(r);new MutationObserver(r=>{for(const e of r)if(e.type==="childList")for(const a of e.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&c(a)}).observe(document,{childList:!0,subtree:!0});function f(r){const e={};return r.integrity&&(e.integrity=r.integrity),r.referrerPolicy&&(e.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?e.credentials="include":r.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function c(r){if(r.ep)return;r.ep=!0;const e=f(r);fetch(r.href,e)}})();var Z=1e-6,V=typeof Float32Array<"u"?Float32Array:Array;Math.hypot||(Math.hypot=function(){for(var t=0,n=arguments.length;n--;)t+=arguments[n]*arguments[n];return Math.sqrt(t)});function z(){var t=new V(16);return V!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0),t[0]=1,t[5]=1,t[10]=1,t[15]=1,t}function k(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t}function j(t,n,f,c){var r=c[0],e=c[1],a=c[2],s=Math.hypot(r,e,a),u,h,m,M,x,E,p,R,A,T,v,_,F,P,w,b,y,L,I,o,l,i,g,d;return s<Z?null:(s=1/s,r*=s,e*=s,a*=s,u=Math.sin(f),h=Math.cos(f),m=1-h,M=n[0],x=n[1],E=n[2],p=n[3],R=n[4],A=n[5],T=n[6],v=n[7],_=n[8],F=n[9],P=n[10],w=n[11],b=r*r*m+h,y=e*r*m+a*u,L=a*r*m-e*u,I=r*e*m-a*u,o=e*e*m+h,l=a*e*m+r*u,i=r*a*m+e*u,g=e*a*m-r*u,d=a*a*m+h,t[0]=M*b+R*y+_*L,t[1]=x*b+A*y+F*L,t[2]=E*b+T*y+P*L,t[3]=p*b+v*y+w*L,t[4]=M*I+R*o+_*l,t[5]=x*I+A*o+F*l,t[6]=E*I+T*o+P*l,t[7]=p*I+v*o+w*l,t[8]=M*i+R*g+_*d,t[9]=x*i+A*g+F*d,t[10]=E*i+T*g+P*d,t[11]=p*i+v*g+w*d,n!==t&&(t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t)}function ee(t,n,f,c,r){var e=1/Math.tan(n/2),a;return t[0]=e/f,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=e,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=-1,t[12]=0,t[13]=0,t[15]=0,r!==1/0?(a=1/(c-r),t[10]=(r+c)*a,t[14]=2*r*c*a):(t[10]=-1,t[14]=-2*c),t}var te=ee;function re(t=30,n=30){const f=[],c=[],r=[];for(let e=0;e<=n;e++){const a=e*Math.PI/n,s=Math.sin(a),u=Math.cos(a);for(let h=0;h<=t;h++){const m=h*2*Math.PI/t,M=Math.sin(m),E=Math.cos(m)*s,p=u,R=M*s,A=h/t,T=e/n;f.push(E,p,R),c.push(A,T)}}for(let e=0;e<n;e++)for(let a=0;a<t;a++){const s=e*(t+1)+a,u=s+t+1;r.push(s,u,s+1),r.push(u,u+1,s+1)}return{positions:f,textureCoordinates:c,indices:r,indexCount:r.length}}function S(t){return t*Math.PI/180}function O(t){return t*180/Math.PI}function W(t,n,f){return Math.max(n,Math.min(f,t))}function ne(t,n){let f=0;return function(...c){const r=Date.now();r-f>=n&&(f=r,t(...c))}}document.getElementById("app").innerHTML=`
  <canvas id="panoramaCanvas"></canvas>
`;const oe=document.getElementById("panoramaCanvas"),H=Array.from({length:16*8},(t,n)=>{const f=Math.floor(n/8)+1,c=n%8+1;return{url:`tiles2/image${f}x${c}.jpg`,pos:{x:f,y:c}}});console.log(H);setTimeout(()=>{const t=ie(oe,H);t.yaw=90,t.fov=100},10);function ie(t,n){const f=window.devicePixelRatio||1;let c=1,r=1;_();const e=t.getContext("webgl");if(!e){console.error("WebGL not supported");return}const a=F(),s=w(a),u=re(90,90),h=b(u),m=y(n);e.bindBuffer(e.ARRAY_BUFFER,h.position),e.vertexAttribPointer(s.attribLocations.vertexPosition,3,e.FLOAT,!1,0,0),e.enableVertexAttribArray(s.attribLocations.vertexPosition),e.bindBuffer(e.ARRAY_BUFFER,h.textureCoord),e.vertexAttribPointer(s.attribLocations.textureCoord,2,e.FLOAT,!1,0,0),e.enableVertexAttribArray(s.attribLocations.textureCoord),e.useProgram(s.program);const M=z(),x=z();function E(){const o=c/r;te(M,v,o,.1,100),k(x),j(x,x,T,[1,0,0]),j(x,x,A,[0,1,0])}function p(){e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.uniformMatrix4fv(s.uniformLocations.projectionMatrix,!1,M),e.uniformMatrix4fv(s.uniformLocations.modelViewMatrix,!1,x),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,m),e.uniform1i(s.uniformLocations.uSampler,0),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,h.indices),e.drawElements(e.TRIANGLES,u.indexCount,e.UNSIGNED_SHORT,0)}let R=!1,A=0,T=0,v=S(90);L(),I(),window.addEventListener("resize",()=>{_(),E(),p()}),E(),p();function _(){const o=t.parentElement;c=o.clientWidth*f,r=o.clientHeight*f,t.width=c,t.height=r}function F(){const o=`
      attribute vec4 aVertexPosition;
      attribute vec2 aTextureCoord;
      varying highp vec2 vTextureCoord;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vTextureCoord = aTextureCoord;
      }
    `,l=`
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      void main(void) {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
      }
    `,i=P(e.VERTEX_SHADER,o),g=P(e.FRAGMENT_SHADER,l),d=e.createProgram();return e.attachShader(d,i),e.attachShader(d,g),e.linkProgram(d),e.getProgramParameter(d,e.LINK_STATUS)?d:(console.error("Unable to initialize the shader program: "+e.getProgramInfoLog(d)),null)}function P(o,l){const i=e.createShader(o);return e.shaderSource(i,l),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS)?i:(console.error("An error occurred compiling the shaders: "+e.getShaderInfoLog(i)),e.deleteShader(i),null)}function w(o){return{program:o,attribLocations:{vertexPosition:e.getAttribLocation(o,"aVertexPosition"),textureCoord:e.getAttribLocation(o,"aTextureCoord")},uniformLocations:{projectionMatrix:e.getUniformLocation(o,"uProjectionMatrix"),modelViewMatrix:e.getUniformLocation(o,"uModelViewMatrix"),uSampler:e.getUniformLocation(o,"uSampler")}}}function b(o){const l=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,l),e.bufferData(e.ARRAY_BUFFER,new Float32Array(o.positions),e.STATIC_DRAW);const i=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,new Float32Array(o.textureCoordinates),e.STATIC_DRAW);const g=e.createBuffer();return e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,g),e.bufferData(e.ELEMENT_ARRAY_BUFFER,new Uint16Array(o.indices),e.STATIC_DRAW),{position:l,textureCoord:i,indices:g}}function y(o){const l=e.createTexture();e.bindTexture(e.TEXTURE_2D,l),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR);const i=0,g=e.RGBA,d=1,U=1,D=0,N=e.RGBA,q=e.UNSIGNED_BYTE,K=new Uint8Array([0,0,0,255]);e.texImage2D(e.TEXTURE_2D,i,g,d,U,D,N,q,K);const C=document.createElement("canvas");C.width=8192,C.height=4096;const B=C.getContext("2d");B.fillStyle="rgba(0, 0, 0, 0)",B.imageSmoothingEnabled=!0,B.imageSmoothingQuality="high";const X=new Image;X.src="./panorama_thumb.jpeg";const G=ne(()=>{e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,C),p()},10);return X.onload=()=>{B.drawImage(X,0,0,8192,4096),G(),o.map(({url:$,pos:{x:Q,y:J}})=>{const Y=new Image;Y.onload=()=>{B.drawImage(Y,(Q-1)*512,(J-1)*512,512,512),G()},Y.src=$})},l}function L(){let o=0,l=0;t.addEventListener("pointerdown",i=>{i.button===0&&(i.preventDefault(),R=!0,t.style.cursor="all-scroll",o=i.clientX,l=i.clientY)}),document.addEventListener("pointermove",i=>{if(!R)return;i.preventDefault();const g=i.clientX-o,d=i.clientY-l,U=.005*(90/(v*180/Math.PI));A-=g*U,T-=d*U;const D=Math.PI/2,N=-Math.PI/2;T=W(T,N,D),o=i.clientX,l=i.clientY,E(),p()}),document.addEventListener("pointerup",()=>{R&&(R=!1,t.style.cursor=null)})}function I(){t.addEventListener("wheel",o=>{o.preventDefault(),v+=o.deltaY*.1*(Math.PI/180),v=W(v,S(30),S(120)),E(),p()})}return{get yaw(){return O(A)},set yaw(o){A=S(o),E(),p()},get pitch(){return O(T)},set pitch(o){T=S(o),E(),p()},get fov(){return O(v)},set fov(o){v=S(o),E(),p()}}}
