function domReady(condition: DocumentReadyState[] = ["complete", "interactive"]) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener("readystatechange", () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child);
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child);
    }
  }
};

function useLoading() {
  const className = `loader`;
  const styleContent = `
    .${className} {
      display: grid;
      grid-template-columns: repeat(4, 64px);
      grid-template-rows: repeat(4, 64px);
      gap: 10px;
    }
    
    .${className} .cube {
      background-color: #fff;
      -webkit-animation: cubeGridScaleDelay 1.3s infinite ease-in-out;
              animation: cubeGridScaleDelay 1.3s infinite ease-in-out; 
    }
    .${className} .cube1 {
      -webkit-animation-delay: 0.3s;
              animation-delay: 0.3s; }
    .${className} .cube2 {
      -webkit-animation-delay: 0.4s;
              animation-delay: 0.4s; }
    .${className} .cube3 {
      -webkit-animation-delay: 0.5s;
              animation-delay: 0.5s; }
    .${className} .cube4 {
      -webkit-animation-delay: 0.6s;
              animation-delay: 0.6s; }
              
    .${className} .cube5 {
      -webkit-animation-delay: 0.2s;
              animation-delay: 0.2s; }
    .${className} .cube6 {
      -webkit-animation-delay: 0.3s;
              animation-delay: 0.3s; }
    .${className} .cube7 {
      -webkit-animation-delay: 0.4s;
              animation-delay: 0.4s; }
    .${className} .cube8 {
      -webkit-animation-delay: 0.5s;
              animation-delay: 0.5s; }
              
    .${className} .cube9 {
      -webkit-animation-delay: 0.1s;
              animation-delay: 0.1s; }
    .${className} .cube10 {
      -webkit-animation-delay: 0.2s;
              animation-delay: 0.2s; }
    .${className} .cube11 {
      -webkit-animation-delay: 0.3s;
              animation-delay: 0.3s; }
    .${className} .cube12 {
      -webkit-animation-delay: 0.4s;
              animation-delay: 0.4s; }
              
    .${className} .cube13 {
      -webkit-animation-delay: 0.0s;
              animation-delay: 0.0s; }
    .${className} .cube14 {
      -webkit-animation-delay: 0.1s;
              animation-delay: 0.1s; }
    .${className} .cube15 {
      -webkit-animation-delay: 0.2s;
              animation-delay: 0.2s; }
    .${className} .cube16 {
      -webkit-animation-delay: 0.3s;
              animation-delay: 0.3s; }
    
    @-webkit-keyframes cubeGridScaleDelay {
      0%, 70%, 100% {
        -webkit-transform: scale3D(1, 1, 1);
                transform: scale3D(1, 1, 1);
      } 35% {
        -webkit-transform: scale3D(0, 0, 1);
                transform: scale3D(0, 0, 1); 
      }
    }
    
    @keyframes cubeGridScaleDelay {
      0%, 70%, 100% {
        -webkit-transform: scale3D(1, 1, 1);
                transform: scale3D(1, 1, 1);
      } 35% {
        -webkit-transform: scale3D(0, 0, 1);
                transform: scale3D(0, 0, 1);
      } 
    }
    
    .app-loading-wrap {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #121212;
      z-index: 9;
    }
  `;
  const oStyle = document.createElement("style");
  const oDiv = document.createElement("div");

  oStyle.id = "app-loading-style";
  oStyle.innerHTML = styleContent;
  oDiv.className = "app-loading-wrap";
  oDiv.innerHTML = `<div class="${className}">
    <div class="cube cube1"></div>
    <div class="cube cube2"></div>
    <div class="cube cube3"></div>
    <div class="cube cube4"></div>
    <div class="cube cube5"></div>
    <div class="cube cube6"></div>
    <div class="cube cube7"></div>
    <div class="cube cube8"></div>
    <div class="cube cube9"></div>
    <div class="cube cube10"></div>
    <div class="cube cube11"></div>
    <div class="cube cube12"></div>
    <div class="cube cube13"></div>
    <div class="cube cube14"></div>
    <div class="cube cube15"></div>
    <div class="cube cube16"></div>
  </div>`;

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    }
  };
}

const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);

window.onmessage = ev => {
  ev.data.payload === "removeLoading" && removeLoading();
};

setTimeout(removeLoading, 5000);
