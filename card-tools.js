customElements.define('card-tools',
class {
  static get CUSTOM_TYPE_PREFIX() { return "custom:"}
  static get version() { return "0.4"}

  static checkVersion(v) {
    if (this.version < v) {
      throw new Error(`Old version of card-tools found. Get the latest version of card-tools.js from https://github.com/thomasloven/lovelace-card-tools`);
    }
  }

  static get LitElement() {
    return Object.getPrototypeOf(customElements.get('home-assistant-main'));
  }
  static litElement() { // Backwards compatibility - deprecated
    return this.LitElement;
  }

  static get LitHtml() {
    return this.litElement().prototype.html;
  }
  static litHtml() { // Backwards compatibility - deprecated
    return this.LitHtml;
  }

  static get LitCSS() {
    return this.litElement().prototype.css;
  }

  static get hass() {
    var hass = function() { // Backwards compatibility - deprecated
      return hass;
    }
    for (var k in document.querySelector('home-assistant').hass)
      hass[k] = document.querySelector('home-assistant').hass[k];
    return hass;
  }

  static fireEvent(ev, detail, entity=null) {
    ev = new Event(ev, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });
    ev.detail = detail || {};
    if(entity) {
      entity.dispatchEvent(ev);
    } else {
      var root = document
        .querySelector("home-assistant")
        .shadowRoot.querySelector("home-assistant-main")
        .shadowRoot.querySelector("app-drawer-layout partial-panel-resolver")
        .shadowRoot.querySelector("ha-panel-lovelace")
        .shadowRoot.querySelector("hui-root")
      if (root)
        root
          .shadowRoot.querySelector("ha-app-layout #view")
          .firstElementChild
          .dispatchEvent(ev);
    }
  }

  static get lovelace() {
    var root = document
      .querySelector("home-assistant")
      .shadowRoot.querySelector("home-assistant-main")
      .shadowRoot.querySelector("app-drawer-layout partial-panel-resolver")
      .shadowRoot.querySelector("ha-panel-lovelace")
      .shadowRoot.querySelector("hui-root")
    if (root) {
      var ll =  root.lovelace
      ll.current_view = root.___curView;
      return ll;
    }
    return null;
  }

  static createThing(thing, config) {
    const _createThing = (tag, config) => {
      const element = document.createElement(tag);
      try {
        element.setConfig(config);
      } catch (err) {
        console.error(tag, err);
        return _createError(err.message, config);
      }
      return element;
    };

    const _createError = (error, config) => {
      return _createThing("hui-error-card", {
        type: "error",
        error,
        config,
      });
    };

    if(!config || typeof config !== "object" || !config.type)
      return _createError(`No ${thing} type configured`, config);
    let tag = config.type;
    if(config.error) {
      const err = config.error;
      delete config.error;
      return _createError(err, config);
    }
    if(tag.startsWith(this.CUSTOM_TYPE_PREFIX))
      tag = tag.substr(this.CUSTOM_TYPE_PREFIX.length);
    else
      tag = `hui-${tag}-${thing}`;

    if(customElements.get(tag))
      return _createThing(tag, config);

    // If element doesn't exist (yet) create an error
    const element = _createError(
      `Custom element doesn't exist: ${tag}.`,
      config
    );
    element.style.display = "None";
    const time = setTimeout(() => {
      element.style.display = "";
    }, 2000);
    // Remove error if element is defined later
    customElements.whenDefined(tag).then(() => {
      clearTimeout(timer);
      this.fireEvent("ll-rebuild", {}, element);
    });

    return element;
  }

  static createCard(config) {
    return this.createThing("card", config);
  }

  static createElement(config) {
    return this.createThing("element", config);
  }

  static createEntityRow(config) {
    const SPECIAL_TYPES = new Set([
      "call-service",
      "divider",
      "section",
      "weblink",
    ]);
    const DEFAULT_ROWS = {
      alert: "toggle",
      automation: "toggle",
      climate: "climate",
      cover: "cover",
      fan: "toggle",
      group: "group",
      input_boolean: "toggle",
      input_number: "input-number",
      input_select: "input-select",
      input_text: "input-text",
      light: "toggle",
      media_player: "media-player",
      lock: "lock",
      scene: "scene",
      script: "script",
      sensor: "sensor",
      timer: "timer",
      switch: "toggle",
      vacuum: "toggle",
      water_heater: "climate",
    };

    if(!config || typeof config !== "object" || (!config.entity && !config.type)) {
      Object.assign(config, {error: "Invalid config given"});
      return this.createThing("", config);
    }

    const type = config.type || "default";
    if(SPECIAL_TYPES.has(type) || type.startsWith(this.CUSTOM_TYPE_PREFIX))
      return this.createThing("row", config);

    const domain = config.entity.split(".", 1)[0];
    Object.assign(config, {type: DEFAULT_ROWS[domain] || "text"});
    return this.createThing("entity-row", config);
  }

  static get deviceID() {
    const ID_STORAGE_KEY = 'lovelace-player-device-id';
    if(window['fully'] && typeof fully.getDeviceId === "function")
      return fully.getDeviceId();
    if(!localStorage[ID_STORAGE_KEY])
    {
      const s4 = () => {
        return Math.floor((1+Math.random())*100000).toString(16).substring(1);
      }
      localStorage[ID_STORAGE_KEY] = `${s4()}${s4()}-${s4()}${s4()}`;
    }
    return localStorage[ID_STORAGE_KEY];
  }

  static moreInfo(entity) {
    this.fireEvent("hass-more-info", {entityId: entity});
  }

  static longpress(element) {
    customElements.whenDefined("long-press").then(() => {
      const longpress = document.body.querySelector("long-press");
      longpress.bind(element);
    });
    return element;
  }

  static hasTemplate(text) {
    return /\[\[\s+.*\s+\]\]/.test(text);
  }

  static parseTemplateString(str) {
    if(typeof(str) !== "string") return text;
    var RE_entity = /^[a-zA-Z0-9_.]+\.[a-zA-Z0-9_]+$/;
    var RE_if = /^if\(([^,]*),([^,]*),(.*)\)$/;
    var RE_expr = /([^=<>!]+)\s*(==|<|>|<=|>=|!=)\s*([^=<>!]+)/

    const _parse_entity = (str) => {
      str = str.trim();
      const parts = str.split(".");
      let v = this.hass().states[`${parts.shift()}.${parts.shift()}`];
      if(!parts.length) return v['state'];
      parts.forEach(item => v=v[item]);
      return v;
    }

    const _parse_expr = (str) => {
      str = RE_expr.exec(str);
      if(str === null) return false;
      const lhs = this.parseTemplateString(str[1]);
      const rhs = this.parseTemplateString(str[3]);
      var expr = ''
      if(!parseFloat(lhs))
        expr = `"${lhs}" ${str[2]} "${rhs}"`;
      else
        expr = `${parseFloat(lhs)} ${str[2]} ${parseFloat(rhs)}`
      return eval(expr);
    }

    const _parse_if = (str) => {
      str = RE_if.exec(str);
      if(_parse_expr(str[1]))
        return this.parseTemplateString(str[2]);
      return this.parseTemplateString(str[3]);
    }

    try {
      str = str.trim();
      if(str.match(RE_if))
        return _parse_if(str);
      if(str.match(RE_entity))
        return _parse_entity(str);
      if(str.match(/^".*"$/) || str.match(/^'.*'$/))
        return str.substr(1, str.length-2);
      if(str.match(/{user}/))
        return this.hass().user.name;
      if(str.match(/{browser}/))
        return this.deviceID();
      if(str.match(/{hash}/))
        return location.hash.substr(1);
      return str;
    } catch (err) {
      return `[[ Template matching failed ${str} ]]`;
    }
  }

  static parseTemplate(text, error) {
    if(typeof(text) !== "string") return text;
    // Note: .*? is javascript regex syntax for NON-greedy matching
    var RE_template = /\[\[\s(.*?)\s\]\]/g;
    text = text.replace(RE_template, (str, p1, offset, s) => this.parseTemplateString(p1));
    return text;
  }

  static args(script=null) {
    script = script || document.currentScript;
    var url = script.src;
    url = url.substr(url.indexOf("?")+1)
    let args = {};
    url.split("&").forEach((a) => {
      if(a.indexOf("=")) {
        let parts = a.split("=");
        args[parts[0]] = parts[1]
      } else {
        args[a] = true;
      }
    });
    return args;
  }

  static localize(key, def="") {
    const language = this.hass().language;
    if(this.hass().resources[language] && this.hass().resources[language][key])
      return this.hass().resources[language][key];
    return def;
  }

  static popUp(title, message, large=false) {
    let popup = document.createElement('div');
    popup.innerHTML = `
    <style>
      app-toolbar {
        color: var(--more-info-header-color);
        background-color: var(--more-info-header-background);
      }
    </style>
    <app-toolbar>
      <paper-icon-button
        icon="hass:close"
        dialog-dismiss=""
      ></paper-icon-button>
      <div class="main-title" main-title="">
        ${title}
      </div>
    </app-toolbar>
  `;
    popup.appendChild(message);
    cardTools.moreInfo(Object.keys(cardTools.hass().states)[0]);
    let moreInfo = document.querySelector("home-assistant")._moreInfoEl;
    moreInfo._page = "none";
    moreInfo.shadowRoot.appendChild(popup);
    moreInfo.large = large;

    setTimeout(() => {
      let interval = setInterval(() => {
        if (moreInfo.getAttribute('aria-hidden')) {
          popup.parentNode.removeChild(popup);
          clearInterval(interval);
        } else {
          message.hass = cardTools.hass();
        }
      }, 100)
    }, 1000);
  }
  static closePopUp() {
    let moreInfo = document.querySelector("home-assistant")._moreInfoEl;
    if (moreInfo) moreInfo.close()
  }

  static logger(message, script=null) {
    if(!('debug' in this.args(script))) return;

    if(typeof message !== "string")
      message = JSON.stringify(message);
    console.log(`%cDEBUG:%c ${message}`,
      "color: blue; font-weight: bold", "");
  }

});

// Global definition of cardTools
var cardTools = customElements.get('card-tools');

console.info(`%cCARD-TOOLS IS INSTALLED
%cDeviceID: ${customElements.get('card-tools').deviceID}`,
"color: green; font-weight: bold",
"");
