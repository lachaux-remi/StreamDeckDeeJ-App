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
    .${className},
    .${className}:before,
    .${className}:after {
      background: #ffffff;
      -webkit-animation: load1 1s infinite ease-in-out;
      animation: load1 1s infinite ease-in-out;
      width: 1em;
      height: 4em;
    }
    .${className} {
      color: #ffffff;
      text-indent: -9999em;
      margin: 88px auto;
      position: relative;
      font-size: 32px;
      -webkit-transform: translateZ(0);
      -ms-transform: translateZ(0);
      transform: translateZ(0);
      -webkit-animation-delay: -0.16s;
      animation-delay: -0.16s;
    }
    .${className}:before,
    .${className}:after {
      position: absolute;
      top: 0;
      content: '';
    }
    .${className}:before {
      left: -1.5em;
      -webkit-animation-delay: -0.32s;
      animation-delay: -0.32s;
    }
    .${className}:after {
      left: 1.5em;
    }
    @-webkit-keyframes load1 {
      0%,
      80%,
      100% {
        box-shadow: 0 0;
        height: 4em;
      }
      40% {
        box-shadow: 0 -2em;
        height: 5em;
      }
    }
    @keyframes load1 {
      0%,
      80%,
      100% {
        box-shadow: 0 0;
        height: 4em;
      }
      40% {
        box-shadow: 0 -2em;
        height: 5em;
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
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

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
