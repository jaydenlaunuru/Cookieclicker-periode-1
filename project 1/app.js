(function () {
  "use strict";

  class Formatter {
    static formatNumber(value) {
      if (value < 1000) return value.toString();
      const units = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
      let unitIndex = 0;
      let n = value;
      while (n >= 1000 && unitIndex < units.length - 1) {
        n /= 1000;
        unitIndex++;
      }
      return `${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)}${units[unitIndex]}`;
    }
  }

  class Upgrade {
    constructor({ id, name, description, baseCost, growth, cps, cpc }) {
      this.id = id;
      this.name = name;
      this.description = description;
      this.baseCost = baseCost;
      this.growth = growth;
      this.count = 0;
      this.cps = cps || 0; 
      this.cpc = cpc || 0; 
    }

    getCost() {
      return Math.floor(this.baseCost * Math.pow(this.growth, this.count));
    }

    toJSON() {
      return {
        id: this.id,
        count: this.count
      };
    }
  }

  class GameState {
    constructor() {
      this.cookies = 0;
      this.totalCookies = 0;
      this.manualClicks = 0;
      this.lastSavedAt = 0;
    }
  }

  class StorageService {
    static save(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        // ignore
      }
    }

    static load(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    }
  }

  class CookieClickerGame {
    constructor() {
      this.state = new GameState();
      this.clickPowerBase = 1;
      this.upgrades = this.createDefaultUpgrades();
      this.tickInterval = null;
      this.autosaveInterval = null;
      this.ui = new UIController(this);
    }

    createDefaultUpgrades() {
      return [
        new Upgrade({ id: "cursor", name: "Cursor", description: "+0.1 cps", baseCost: 15, growth: 1.15, cps: 0.1 }),
        new Upgrade({ id: "click", name: "Sterkere klik", description: "+1 cpc", baseCost: 50, growth: 1.25, cpc: 1 }),
        new Upgrade({ id: "grandma", name: "Oma", description: "+1 cps", baseCost: 100, growth: 1.15, cps: 1 }),
        new Upgrade({ id: "farm", name: "Boerderij", description: "+8 cps", baseCost: 1100, growth: 1.15, cps: 8 }),
        new Upgrade({ id: "mine", name: "Mijn", description: "+47 cps", baseCost: 12000, growth: 1.15, cps: 47 }),
        new Upgrade({ id: "factory", name: "Fabriek", description: "+260 cps", baseCost: 130000, growth: 1.15, cps: 260 })
      ];
    }

    get cookiesPerSecond() {
      let cps = 0;
      for (const u of this.upgrades) cps += u.cps * u.count;
      return cps;
    }

    get cookiesPerClick() {
      let cpc = this.clickPowerBase;
      for (const u of this.upgrades) cpc += u.cpc * u.count;
      return cpc;
    }

    addCookies(amount) {
      this.state.cookies += amount;
      this.state.totalCookies += amount;
      this.ui.updateStats();
    }

    canAfford(cost) {
      return this.state.cookies >= cost;
    }

    buyUpgrade(id) {
      const upg = this.upgrades.find(u => u.id === id);
      if (!upg) return false;
      const cost = upg.getCost();
      if (!this.canAfford(cost)) return false;
      this.state.cookies -= cost;
      upg.count += 1;
      this.ui.updateStats();
      this.ui.renderShop();
      return true;
    }

    click() {
      const amount = this.cookiesPerClick;
      this.addCookies(amount);
      this.state.manualClicks += 1;
      this.ui.spawnFloat(`+${Formatter.formatNumber(amount)}`);
    }

    tick(deltaSeconds) {
      const earned = this.cookiesPerSecond * deltaSeconds;
      if (earned > 0) this.addCookies(earned);
    }

    save() {
      const data = {
        state: this.state,
        upgrades: this.upgrades.map(u => u.toJSON()),
        version: 1
      };
      this.state.lastSavedAt = Date.now();
      StorageService.save("cookie-clicker-oop", data);
      this.ui.toast("Opgeslagen", "success");
    }

    load() {
      const data = StorageService.load("cookie-clicker-oop", null);
      if (!data) return;
      Object.assign(this.state, data.state);
      for (const saved of data.upgrades || []) {
        const u = this.upgrades.find(x => x.id === saved.id);
        if (u) u.count = saved.count || 0;
      }
    }

    start() {
      this.load();
      this.ui.mount();
      let last = performance.now();
      const loop = (now) => {
        const delta = (now - last) / 1000;
        last = now;
        this.tick(delta);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      this.autosaveInterval = setInterval(() => this.save(), 10000);
    }

    reset() {
      if (!confirm("Weet je zeker dat je wilt resetten?")) return;
      this.state = new GameState();
      this.upgrades = this.createDefaultUpgrades();
      this.ui.renderShop();
      this.ui.updateStats();
      this.save();
      this.ui.toast("Gerest", "danger");
    }

    restart() {
      if (!confirm("Helemaal opnieuw beginnen? Dit wist je opgeslagen spel.")) return;
      try { localStorage.removeItem("cookie-clicker-oop"); } catch (_) {}
      location.reload();
    }
  }

  class UIController {
    constructor(game) {
      this.game = game;
      this.$ = {
        cookies: document.getElementById("cookieCount"),
        cps: document.getElementById("cps"),
        cpc: document.getElementById("cpc"),
        button: document.getElementById("cookieButton"),
        shop: document.getElementById("shopList"),
        save: document.getElementById("saveBtn"),
        reset: document.getElementById("resetBtn"),
        restart: document.getElementById("restartBtn"),
        floatContainer: document.getElementById("floatingContainer")
      };
    }

    mount() {
      this.renderShop();
      this.updateStats();
      this.$.button.addEventListener("click", () => this.game.click());
      this.$.save.addEventListener("click", () => this.game.save());
      this.$.reset.addEventListener("click", () => this.game.reset());
      this.$.restart.addEventListener("click", () => this.game.restart());
    }

    renderShop() {
      const frag = document.createDocumentFragment();
      for (const upg of this.game.upgrades) {
        const item = document.createElement("div");
        item.className = "shop-item";

        const meta = document.createElement("div");
        meta.className = "meta";
        const title = document.createElement("div");
        title.className = "title";
        title.textContent = `${upg.name} × ${upg.count}`;
        const desc = document.createElement("div");
        desc.className = "desc";
        desc.textContent = upg.description;
        const price = document.createElement("div");
        price.className = "price";
        price.textContent = `${Formatter.formatNumber(upg.getCost())} 🍪`;
        meta.appendChild(title);
        meta.appendChild(desc);
        meta.appendChild(price);

        const btn = document.createElement("button");
        btn.textContent = "Koop";
        const affordable = this.game.canAfford(upg.getCost());
        btn.disabled = !affordable;
        btn.addEventListener("click", () => this.game.buyUpgrade(upg.id));

        item.appendChild(meta);
        item.appendChild(btn);
        frag.appendChild(item);
      }
      this.$.shop.innerHTML = "";
      this.$.shop.appendChild(frag);
    }

    updateStats() {
      this.$.cookies.textContent = Formatter.formatNumber(Math.floor(this.game.state.cookies));
      this.$.cps.textContent = this.game.cookiesPerSecond.toFixed(1);
      this.$.cpc.textContent = Formatter.formatNumber(this.game.cookiesPerClick);
      const items = this.$.shop.querySelectorAll(".shop-item");
      items.forEach((item, idx) => {
        const upg = this.game.upgrades[idx];
        const btn = item.querySelector("button");
        const meta = item.querySelector(".meta .title");
        const price = item.querySelector(".meta .price");
        if (btn) btn.disabled = !this.game.canAfford(upg.getCost());
        if (meta) meta.textContent = `${upg.name} × ${upg.count}`;
        if (price) price.textContent = `${Formatter.formatNumber(upg.getCost())} 🍪`;
      });
    }

    spawnFloat(text) {
      const el = document.createElement("div");
      el.className = "float";
      el.textContent = text;
      this.$.floatContainer.appendChild(el);
      const duration = 800;
      el.animate([
        { transform: "translateY(0)", opacity: 0 },
        { transform: "translateY(-10px)", opacity: 1, offset: 0.25 },
        { transform: "translateY(-40px)", opacity: 0 }
      ], { duration, easing: "ease-out" });
      setTimeout(() => el.remove(), duration + 20);
    }

    toast(message, type) {
      const el = document.createElement("div");
      el.textContent = message;
      el.style.position = "fixed";
      el.style.bottom = "20px";
      el.style.left = "50%";
      el.style.transform = "translateX(-50%)";
      el.style.padding = "10px 14px";
      el.style.borderRadius = "10px";
      el.style.background = type === "danger" ? "#ff6b6b" : type === "success" ? "#34d399" : "#7c9bff";
      el.style.color = "#0b1029";
      el.style.fontWeight = "800";
      el.style.boxShadow = "0 8px 24px rgba(0,0,0,.4)";
      document.body.appendChild(el);
      const duration = 1200;
      el.animate([
        { transform: "translate(-50%, 10px)", opacity: 0 },
        { transform: "translate(-50%, 0)", opacity: 1 },
        { transform: "translate(-50%, -6px)", opacity: 0 }
      ], { duration, easing: "ease-out" });
      setTimeout(() => el.remove(), duration + 30);
    }
  }

  // Bootstrap
  window.addEventListener("DOMContentLoaded", () => {
    const game = new CookieClickerGame();
    game.start();
  });
})();


