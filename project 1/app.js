// Simple Cookie Clicker (OOP, beginner-friendly)
// This file contains the main game logic for the Cookie Clicker project.
// Each section below is a small class with a short comment explaining its purpose.
(function () {
  "use strict";

  // Formatter: small helper for showing large numbers nicely
  class Formatter {
    // formatNumber: turn 1500 -> "1.50K" (shortened string for display)
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

  // Upgrade: represents a buyable item in the shop (cursor, grandma, etc.)
  class Upgrade {
    // constructor: create an upgrade with its properties
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

    // getCost: cost increases with how many we own
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

  // GameState: small object that stores numbers we persist (cookies, totals)
  class GameState {
    constructor() {
      this.cookies = 0; // current cookies you can spend
      this.totalCookies = 0; // lifetime total (for achievements)
      this.manualClicks = 0; // how many times clicked
      this.lastSavedAt = 0; // timestamp when we last saved
    }
  }

  // StorageService: tiny wrapper around localStorage for JSON saving/loading
  class StorageService {
    // save: store object under a key
    static save(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        // ignore storage errors for now
      }
    }

    // load: read JSON and parse, return fallback if missing
    static load(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    }
  }

  // CookieClickerGame: main game class — keeps state and ties subsystems together
  class CookieClickerGame {
    // constructor: set up default state, services and UI
    constructor() {
      this.state = new GameState();
      this.clickPowerBase = 1;
      this.upgrades = this.createDefaultUpgrades();
      this.tickInterval = null;
      this.autosaveInterval = null;
      this.ui = new UIController(this);
      this.achievements = new AchievementService(this, this.ui);
      this.themeService = new ThemeService(this, this.ui);
      this.started = false;
      // settings (persisted separately)
      this.settings = {
        autosaveEnabled: true,
        autosaveIntervalSec: 10
      };
      // default sound on
      this.settings.soundEnabled = true;
      this.loadSettings();
      this.soundService = new SoundService(this);
    }

    // createDefaultUpgrades: returns an array of upgrades available in shop
    createDefaultUpgrades() {
      return [
        new Upgrade({ id: "cursor", name: "Cursor", description: "+0.1 cps", baseCost: 15, growth: 1.1, cps: 0.1 }),
        new Upgrade({ id: "click", name: "Sterkere klik", description: "+1 cpc", baseCost: 50, growth: 1.1, cpc: 1 }),
        new Upgrade({ id: "grandma", name: "Oma", description: "+1 cps", baseCost: 100, growth: 1.2, cps: 1 }),
        new Upgrade({ id: "farm", name: "Boerderij", description: "+8 cps", baseCost: 1100, growth: 1.2, cps: 8 }),
        new Upgrade({ id: "mine", name: "Mijn", description: "+47 cps", baseCost: 12000, growth: 1.3, cps: 47 }),
        new Upgrade({ id: "factory", name: "Fabriek", description: "+260 cps", baseCost: 130000, growth: 1.4, cps: 260 })
      ];
    }

    // cookiesPerSecond: sum of all passive cookie production
    get cookiesPerSecond() {
      let cps = 0;
      for (const u of this.upgrades) cps += u.cps * u.count;
      return cps;
    }

    // cookiesPerClick: how many cookies you get when you click
    get cookiesPerClick() {
      let cpc = this.clickPowerBase;
      for (const u of this.upgrades) cpc += u.cpc * u.count;
      return cpc;
    }

    // addCookies: add to current and lifetime totals and update UI
    addCookies(amount) {
      this.state.cookies += amount;
      this.state.totalCookies += amount;
      this.ui.updateStats();
    }

    // canAfford: check if player has enough cookies (use floor to avoid tiny fractions)
    canAfford(cost) {
      return Math.floor(this.state.cookies) >= cost;
    }

    // buyUpgrade: attempt to purchase an upgrade, returns true on success
    buyUpgrade(id) {
      const upg = this.upgrades.find(u => u.id === id);
      if (!upg) return false;
      const cost = upg.getCost();
      if (!this.canAfford(cost)) return false;
      this.state.cookies -= cost;
      upg.count += 1;
      // refresh shop UI after buying
      if (this.ui && this.ui.renderShopPanel) this.ui.renderShopPanel();
      else {
        this.ui.updateStats();
        this.ui.renderShop();
      }
      return true;
    }

    // click: handle a manual click (gain cookies and visual float)
    click() {
      const amount = this.cookiesPerClick;
      this.addCookies(amount);
      this.state.manualClicks += 1;
      this.ui.spawnFloat(`+${Formatter.formatNumber(amount)}`);
      try { if (this.soundService) this.soundService.playClick(); } catch (_) {}
    }

    // tick: called every frame to apply passive income and check achievements
    tick(deltaSeconds) {
      const earned = this.cookiesPerSecond * deltaSeconds;
      if (earned > 0) this.addCookies(earned);
      this.achievements.checkAchievements();
      if (this.themeService) this.themeService.checkUnlocks();
    }

    // save: persist game state (upgrades, themes, and state) to localStorage
    save() {
      const data = {
        state: this.state,
        upgrades: this.upgrades.map(u => u.toJSON()),
        version: 1,
        themes: {
          unlocked: Array.from(this.themeService ? this.themeService.unlocked : []),
          owned: Array.from(this.themeService ? this.themeService.owned : []),
          current: this.themeService ? this.themeService.current : 'default'
        }
      };
      this.state.lastSavedAt = Date.now();
      StorageService.save("cookie-clicker-oop", data);
      this.ui.toast("Opgeslagen", "success");
    }

    // load: read persisted data and restore game objects
    load() {
      const data = StorageService.load("cookie-clicker-oop", null);
      if (!data) return;
      Object.assign(this.state, data.state);
      for (const saved of data.upgrades || []) {
        const u = this.upgrades.find(x => x.id === saved.id);
        if (u) u.count = saved.count || 0;
      }
      if (this.themeService) this.themeService.load(data.themes || null);
    }

    // start: initialize UI, restore data and begin the game loop
    start() {
      if (this.started) return;
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
      // autosave only if enabled
      if (this.settings && this.settings.autosaveEnabled) {
        const ms = (this.settings.autosaveIntervalSec || 10) * 1000;
        this.autosaveInterval = setInterval(() => this.save(), ms);
      }
      this.started = true;
    }

    // loadSettings: read small UI settings like sound on/off
    loadSettings() {
      try {
        const raw = localStorage.getItem('cookie-settings');
        if (!raw) return;
        const s = JSON.parse(raw);
        if (typeof s.soundEnabled === 'boolean') this.settings.soundEnabled = s.soundEnabled;
      } catch (_) {}
    }

    // saveSettings: persist small UI settings
    saveSettings() {
      try {
        const out = { soundEnabled: !!this.settings.soundEnabled };
        if (typeof this.settings.autosaveEnabled === 'boolean') out.autosaveEnabled = this.settings.autosaveEnabled;
        if (typeof this.settings.autosaveIntervalSec === 'number') out.autosaveIntervalSec = this.settings.autosaveIntervalSec;
        localStorage.setItem('cookie-settings', JSON.stringify(out));
      } catch (_) {}
    }

    // reset: restore a fresh game after confirmation
    reset() {
      if (!confirm("Weet je zeker dat je wilt resetten?")) return;
      this.state = new GameState();
      this.upgrades = this.createDefaultUpgrades();
      if (this.themeService) this.themeService.reset();
      this.ui.renderShop();
      this.ui.updateStats();
      this.save();
      this.ui.toast("Gerest", "danger");
    }
  }

  // UIController: handles all DOM updates and user interactions
  // This class reads the game state and renders the shop, achievements,
  // theme lists and small UI feedback (toasts, floats).
  class UIController {
    constructor(game) {
      this.game = game;
      this.$ = {
        cookies: document.getElementById("cookieCount"),
        cps: document.getElementById("cps"),
        cpc: document.getElementById("cpc"),
        button: document.getElementById("cookieButton"),
        img: document.querySelector("#cookieButton .cookie-img"),
        shop: document.getElementById("shopList"),
        reset: document.getElementById("resetBtn"),
        floatContainer: document.getElementById("floatingContainer")
      };
      this.activeTab = 'shop';
      this.$.shopSection = document.querySelector('.shop');
      // start screen & settings elements (may not exist yet when UIController constructed, so query lazily in mount)
      this.startScreen = null;
      this.settingsModal = null;
      this.playBtn = null;
      this.openSettingsBtn = null;
      this.saveSettingsBtn = null;
      this.closeSettingsBtn = null;
    }

    mount() {
      this.renderShopPanel();
      this.updateStats();
  // query start/settings elements now that DOM is ready
  this.startScreen = document.getElementById('startScreen');
  this.settingsModal = document.getElementById('settingsModal');
  this.playBtn = document.getElementById('playBtn');
  this.openSettingsBtn = document.getElementById('openSettingsBtn');
  this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  this.closeSettingsBtn = document.getElementById('closeSettingsBtn');


    
      
      // header settings icon (top-left)
      const headerSettings = document.getElementById('settingsIcon');
      if (headerSettings) headerSettings.addEventListener('click', () => this.showSettings());

      if (this.playBtn) {
        this.playBtn.addEventListener('click', () => {
          // apply settings currently in UI before starting
          this.readSettingsFromUI();
          this.game.saveSettings();
          this.hideStartScreen();
          this.game.start();
        });
      }
      if (this.openSettingsBtn) this.openSettingsBtn.addEventListener('click', () => this.showSettings());
      if (this.closeSettingsBtn) this.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
      if (this.saveSettingsBtn) this.saveSettingsBtn.addEventListener('click', () => {
        this.readSettingsFromUI();
        this.game.saveSettings();
        this.hideSettings();
      });
      const resetProgressBtn = document.getElementById('resetProgressBtn');
      if (resetProgressBtn) resetProgressBtn.addEventListener('click', () => {
        // call game's reset (already asks confirm)
        this.hideSettings();
        this.game.reset();
      });

      // --- Debug / demo button (useful when presenting) ---
      // Add a small button in settings to quickly unlock all achievements/themes
      if (this.settingsModal) {
        let dbg = this.settingsModal.querySelector('#unlockAllBtn');
        if (!dbg) {
          dbg = document.createElement('button');
          dbg.id = 'unlockAllBtn';
          dbg.textContent = 'Demo: Unlock alles';
          dbg.className = 'secondary';
          dbg.style.marginTop = '8px';
          this.settingsModal.appendChild(dbg);
        }
        dbg.addEventListener('click', () => {
          try {
            // mark all achievements unlocked and unlock/own all themes
            for (const a of this.game.achievements.achievements) {
              this.game.achievements.unlocked.add(a.id);
              if (a.themeId && this.game.themeService) this.game.themeService.unlocked.add(a.themeId);
            }
            if (this.game.themeService) {
              for (const t of this.game.themeService.themes) this.game.themeService.owned.add(t.id);
            }
            this.toast('Alle achievements ontgrendeld (demo)', 'success');
            if (this.renderShopPanel) this.renderShopPanel();
          } catch (e) { console.error(e); }
        });
      }

      // populate UI with saved settings
      this.writeSettingsToUI();
      const clickable = this.$.img || this.$.button;
      clickable.addEventListener("click", (ev) => {
        const rect = this.$.button.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        this.game.click();
        const last = this.$.floatContainer.lastElementChild;
        if (last) {
          last.style.left = x + "px";
          last.style.top = y + "px";
        }
      });
      // footer reset removed; reset now in settings modal
    }

    showStartScreen() {
      if (!this.startScreen) return;
      this.startScreen.style.display = 'grid';
      this.startScreen.setAttribute('aria-hidden', 'false');
    }

    notifyAchievement(ach) {
      // create container if missing
      let container = document.getElementById('leftNotifyContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'leftNotifyContainer';
        container.className = 'left-notify-container';
        document.body.appendChild(container);
      }

      const el = document.createElement('div');
      el.className = 'left-notify show';

      const icon = document.createElement('div');
      icon.className = 'icon';
      // choose emoji based on achievement target size
      let emoji = '🎉';
      let color = 'var(--primary)';
      try {
        const t = ach.target || 0;
        if (t >= 10000000) { emoji = '🏆'; color = '#f59e0b'; }
        else if (t >= 5000000) { emoji = '🥇'; color = '#f97316'; }
        else if (t >= 1000000) { emoji = '🎖️'; color = '#f97316'; }
        else if (t >= 500000) { emoji = '✨'; color = '#f97316'; }
        else if (t >= 100000) { emoji = '🔥'; color = '#10b981'; }
        else if (t >= 50000) { emoji = '❤️'; color = '#ef4444'; }
        else { emoji = '🎉'; color = 'var(--primary)'; }
      } catch (_) {}
      icon.textContent = emoji;

      const body = document.createElement('div');
      body.className = 'body';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = `Hoeraaa! ${ach.name} behaald`;
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = ach.description || '';

      body.appendChild(title);
      body.appendChild(sub);

      el.appendChild(icon);
      el.appendChild(body);
      // set accent color
      el.style.borderLeftColor = color;

      container.appendChild(el);

      // remove after duration
      const duration = 3500;
      setTimeout(() => {
        el.classList.remove('show');
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }, duration);
    }

    hideStartScreen() {
      if (!this.startScreen) return;
      this.startScreen.style.display = 'none';
      this.startScreen.setAttribute('aria-hidden', 'true');
    }

    showSettings() {
      if (!this.settingsModal) return;
      this.settingsModal.setAttribute('aria-hidden', 'false');
    }

    hideSettings() {
      if (!this.settingsModal) return;
      this.settingsModal.setAttribute('aria-hidden', 'true');
    }

    writeSettingsToUI() {
      const s = this.game.settings || { soundEnabled: true };
      // sound toggle
      const soundToggle = document.getElementById('soundToggle');
      if (soundToggle) soundToggle.checked = !!(s.soundEnabled !== false);
    }

    readSettingsFromUI() {
      try {
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) this.game.settings.soundEnabled = !!soundToggle.checked;
      } catch (_) {}
    }
    renderShop() {
      // Ensure we have a stable shop-list element to render into (inside panel-content when present)
      const panelContent = this.$.shopSection ? this.$.shopSection.querySelector('.panel-content') : null;
      if (panelContent) {
        // ensure a dedicated .shop-list exists inside the panel content
        let shopList = panelContent.querySelector('.shop-list');
        if (!shopList) {
          shopList = document.createElement('div');
          shopList.className = 'shop-list';
          shopList.id = 'shopList';
          panelContent.appendChild(shopList);
        }
        this.$.shop = shopList;
      }
      const container = this.$.shop || document.createElement('div');
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
      if (container) {
        container.innerHTML = "";
        container.appendChild(frag);
      }
    }

    renderShopPanel() {
      if (!this.$.shopSection) return this.renderShop();
      // ensure tab and content containers exist
      let tabs = this.$.shopSection.querySelector('.panel-tabs');
      if (!tabs) {
        tabs = document.createElement('div');
        tabs.className = 'panel-tabs';
        this.$.shopSection.insertBefore(tabs, this.$.shopSection.firstChild);
      }
      let content = this.$.shopSection.querySelector('.panel-content');
      if (!content) {
        content = document.createElement('div');
        content.className = 'panel-content';
        // move existing shop list into content on first render
        const existing = this.$.shop;
        content.appendChild(existing);
        this.$.shopSection.appendChild(content);
      }

      // render tabs
      tabs.innerHTML = '';
      const tabsDef = [
        { id: 'shop', label: 'Winkel' },
        { id: 'achievements', label: 'Achievements' },
        { id: 'themes', label: "Thema's" }
      ];
      for (const t of tabsDef) {
        const b = document.createElement('button');
        b.className = 'tab-btn' + (this.activeTab === t.id ? ' active' : '');
        b.textContent = t.label;
        b.addEventListener('click', () => {
          this.activeTab = t.id;
          this.renderShopPanel();
        });
        tabs.appendChild(b);
      }

      // render content for active tab
      content.innerHTML = '';
      // ensure the panel title exists and set it depending on active tab
      let titleEl = this.$.shopSection.querySelector('.panel-title');
      if (!titleEl) {
        titleEl = document.createElement('h2');
        titleEl.className = 'panel-title';
        this.$.shopSection.insertBefore(titleEl, this.$.shopSection.querySelector('.panel-content'));
      }
      // show title only for the shop tab
      titleEl.textContent = this.activeTab === 'shop' ? 'Winkel' : '';
      if (this.activeTab === 'shop') {
        // ensure shopList exists
        if (!this.$.shop) {
          const shopList = document.createElement('div');
          shopList.id = 'shopList';
          shopList.className = 'shop-list';
          this.$.shop = shopList;
        }
        content.appendChild(this.$.shop);
        this.renderShop();
      } else if (this.activeTab === 'achievements') {
        this.renderAchievements(content);
      } else if (this.activeTab === 'themes') {
        this.renderThemes(content);
      }
    }

    // render achievements into a provided container (panel). If container omitted, try to find achievementsBox (fallback).
    renderAchievements(container) {
      const box = container || document.getElementById("achievementsBox");
      if (!box) return;
      box.innerHTML = "<div style='font-weight:bold; margin-bottom:8px;'>Achievements</div><div class='achievements-list'></div>";
      const list = box.querySelector('.achievements-list');
      const total = this.game.state.totalCookies || 0;
      for (const ach of this.game.achievements.achievements) {
        const unlocked = this.game.achievements.unlocked.has(ach.id);
        const row = document.createElement('div');
        row.className = 'achievement-row';
        const left = document.createElement('div');
        left.className = 'achievement-meta';
        const title = document.createElement('div');
        title.className = 'achievement-title';
        title.textContent = unlocked ? `✅ ${ach.name}` : `🔒 ${ach.name}`;
        const desc = document.createElement('div');
        desc.className = 'achievement-desc';
        desc.textContent = ach.description;
        left.appendChild(title);
        left.appendChild(desc);

        const right = document.createElement('div');
        right.className = 'achievement-progress';
        const target = ach.target || 1;
        const progress = Math.min(1, (total / target));
        const progressTrack = document.createElement('div');
        progressTrack.className = 'progress-track';
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = `${Math.round(progress * 100)}%`;
        progressTrack.appendChild(progressFill);
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = `${Formatter.formatNumber(Math.floor(total))} / ${Formatter.formatNumber(target)}`;
        right.appendChild(progressTrack);
        right.appendChild(progressText);

        row.appendChild(left);
        row.appendChild(right);
        list.appendChild(row);
      }
    }

    renderThemes(container) {
      const box = container || document.getElementById("achievementsBox");
      if (!box) return;
      box.innerHTML = "<div style='font-weight:bold; margin-bottom:8px;'>Thema's</div><div class='themes-list'></div>";
      const themesList = box.querySelector('.themes-list');
      for (const t of this.game.themeService.themes) {
        const unlocked = this.game.themeService.unlocked.has(t.id);
        const owned = this.game.themeService.owned.has(t.id);
        const row = document.createElement('div');
        row.className = 'theme-row';
        const label = document.createElement('div');
        label.className = 'theme-label';
        label.textContent = unlocked ? `🎨 ${t.name}` : `🔒 ${t.name}`;
        label.title = unlocked ? (owned ? `Je bezit ${t.name}` : `Prijs: ${Formatter.formatNumber(t.price)} 🍪`) : `Wordt ontgrendeld bij ${t.unlockAt} cookies`;

        const btn = document.createElement('button');
        if (!unlocked) {
          btn.textContent = 'Locked';
          btn.disabled = true;
        } else if (!owned) {
          btn.textContent = `Koop ${Formatter.formatNumber(t.price)} 🍪`;
          btn.disabled = !this.game.canAfford(t.price);
          btn.className = 'secondary';
          btn.addEventListener('click', () => {
            this.game.themeService.purchaseTheme(t.id);
            this.renderShopPanel();
          });
        } else {
          btn.textContent = (this.game.themeService.current === t.id) ? 'Actief' : 'Selecteer';
          btn.disabled = false;
          btn.className = 'secondary';
          btn.addEventListener('click', () => {
            this.game.themeService.applyTheme(t.id);
            this.renderShopPanel();
          });
        }

        row.appendChild(label);
        row.appendChild(btn);
        themesList.appendChild(row);
      }
    }

    updateStats() {
      this.$.cookies.textContent = Formatter.formatNumber(Math.floor(this.game.state.cookies));
      this.$.cps.textContent = this.game.cookiesPerSecond.toFixed(1);
      this.$.cpc.textContent = Formatter.formatNumber(this.game.cookiesPerClick);
      // prefer the shop-list inside the panel (if present) otherwise fall back
      const shopList = (this.$.shopSection && this.$.shopSection.querySelector('.shop-list')) || this.$.shop;
      if (shopList) {
        const items = shopList.querySelectorAll(".shop-item");
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
      this.renderAchievements();
    }

    spawnFloat(text) {
      const el = document.createElement("div");
      el.className = "float";
      el.textContent = `${text}🍪`;
      el.style.left = "50%";
      el.style.top = "50%";
      this.$.floatContainer.appendChild(el);
      const duration = 900;
      const driftX = (Math.random() * 40 - 20); 
      const rise = 60 + Math.random() * 20;
      el.animate([
        { transform: "translate(-50%, -50%) translate(0, 0) scale(.9)", opacity: 0 },
        { transform: `translate(-50%, -50%) translate(${driftX * 0.3}px, -${rise * 0.3}px) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(-50%, -50%) translate(${driftX}px, -${rise}px) scale(1.05)`, opacity: 0 }
      ], { duration, easing: "cubic-bezier(.22,.61,.36,1)" });
      setTimeout(() => el.remove(), duration + 40);
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

  class AchievementService {
    constructor(game, ui) {
      this.game = game;
      this.ui = ui;
      // Achievements mapped to theme IDs so unlocking an achievement unlocks a theme
      // Each achievement includes a numeric `target` for progress display
      this.achievements = [
        { id: '10k', name: '10.000 Cookies', description: 'Je hebt 10.000 cookies verzameld.', target: 10000, condition: s => s.totalCookies >= 10000, themeId: 't10k' },
        { id: '50k', name: '50.000 Cookies', description: 'Je hebt 50.000 cookies verzameld.', target: 50000, condition: s => s.totalCookies >= 50000, themeId: 't50k' },
        { id: '100k', name: '100.000 Cookies', description: 'Je hebt 100.000 cookies verzameld.', target: 100000, condition: s => s.totalCookies >= 100000, themeId: 't100k' },
        { id: '200k', name: '200.000 Cookies', description: 'Je hebt 200.000 cookies verzameld.', target: 200000, condition: s => s.totalCookies >= 200000, themeId: 't200k' },
        { id: '500k', name: '500.000 Cookies', description: 'Je hebt 500.000 cookies verzameld.', target: 500000, condition: s => s.totalCookies >= 500000, themeId: 't500k' },
        { id: '1m', name: '1.000.000 Cookies', description: 'Je hebt 1.000.000 cookies verzameld.', target: 1000000, condition: s => s.totalCookies >= 1000000, themeId: 't1m' },
        { id: '2m', name: '2.000.000 Cookies', description: 'Je hebt 2.000.000 cookies verzameld.', target: 2000000, condition: s => s.totalCookies >= 2000000, themeId: 't2m' },
        { id: '5m', name: '5.000.000 Cookies', description: 'Je hebt 5.000.000 cookies verzameld.', target: 5000000, condition: s => s.totalCookies >= 5000000, themeId: 't5m' },
        { id: '10m', name: '10.000.000 Cookies', description: 'Je hebt 10.000.000 cookies verzameld.', target: 10000000, condition: s => s.totalCookies >= 10000000, themeId: 't10m' }
      ];
      this.unlocked = new Set();
    }

    // checkAchievements: examine achievement conditions and unlock when met
    // We also notify the UI so the player sees progress and unlocked themes
    checkAchievements() {
      let unlockedAny = false;
      for (const ach of this.achievements) {
        if (!this.unlocked.has(ach.id) && ach.condition(this.game.state)) {
          this.unlocked.add(ach.id);
          this.ui.toast(ach.description, "success");
          try { if (this.ui && typeof this.ui.notifyAchievement === 'function') this.ui.notifyAchievement(ach); } catch (_) {}
          // if achievement awards a theme, unlock it in ThemeService
          try {
            if (ach.themeId && this.game.themeService) {
              this.game.themeService.unlocked.add(ach.themeId);
              this.ui.toast(`Thema ontgrendeld: ${ach.themeId}`, 'success');
            }
          } catch (_) {}
          unlockedAny = true;
        }
      }
      if (unlockedAny) {
        if (this.ui.renderShopPanel) this.ui.renderShopPanel();
        else if (this.ui.renderAchievements) this.ui.renderAchievements();
      }
    }
  }

  class ThemeService {
    constructor(game, ui) {
      this.game = game;
      this.ui = ui;
      // Expanded theme list including achievement-themed ids
      this.themes = [
        { id: 'default', name: 'Standaard', cssClass: '', unlockAt: 0, price: 0 },
        { id: 't10k', name: 'Ocean (10k)', cssClass: 'theme-t10k', unlockAt: 10000, price: 2000 },
        { id: 't50k', name: 'Rood (50k)', cssClass: 'theme-t50k', unlockAt: 50000, price: 20000 },
        { id: 't100k', name: 'Groen (100k)', cssClass: 'theme-t100k', unlockAt: 100000, price: 50000 },
        { id: 't200k', name: 'Paars (200k)', cssClass: 'theme-t200k', unlockAt: 200000, price: 100000 },
        { id: 't500k', name: 'Goud (500k)', cssClass: 'theme-t500k', unlockAt: 500000, price: 200000 },
        { id: 't1m', name: 'Sky (1M)', cssClass: 'theme-t1m', unlockAt: 1000000, price: 500000 },
        { id: 't2m', name: 'Rose (2M)', cssClass: 'theme-t2m', unlockAt: 2000000, price: 1000000 },
        { id: 't5m', name: 'DeepBlue (5M)', cssClass: 'theme-t5m', unlockAt: 5000000, price: 3000000 },
        { id: 't10m', name: 'Legend (10M)', cssClass: 'theme-t10m', unlockAt: 10000000, price: 10000000 }
      ];
      this.unlocked = new Set(['default']);
      this.owned = new Set(['default']);
      this.current = 'default';
    }

    // checkUnlocks: reveal themes when player reaches their unlock threshold

    checkUnlocks() {
      let any = false;
      for (const t of this.themes) {
        if (!this.unlocked.has(t.id) && this.game.state.totalCookies >= t.unlockAt) {
          this.unlocked.add(t.id);
          any = true;
          this.ui.toast(`${t.name} thema ontgrendeld — je kunt het nu kopen in 'Thema's'`, 'success');
        }
      }
      if (any) {
        if (this.ui.renderShopPanel) this.ui.renderShopPanel();
        else if (this.ui.renderAchievements) this.ui.renderAchievements();
      }
    }

    purchaseTheme(id) {
      const t = this.themes.find(x => x.id === id);
      if (!t) return false;
      if (!this.unlocked.has(id)) {
        this.ui.toast('Thema nog niet ontgrendeld', 'danger');
        return false;
      }
      if (this.owned.has(id)) {
        this.ui.toast('Je bezit dit thema al', 'success');
        return false;
      }
      if (!this.game.canAfford(t.price)) {
        this.ui.toast('Niet genoeg cookies', 'danger');
        return false;
      }
      // Deduct and grant ownership
      this.game.state.cookies -= t.price;
      this.owned.add(id);
      try { this.game.save(); } catch (_) {}
      // play purchase sound
      try { if (this.game.soundService) this.game.soundService.playPurchase(); } catch (_) {}
      this.ui.toast(`${t.name} thema gekocht!`, 'success');
      if (this.ui && this.ui.renderShopPanel) this.ui.renderShopPanel();
      return true;
    }

    applyTheme(id) {
      const t = this.themes.find(x => x.id === id);
      if (!t) return;
      // require ownership to apply (except default)
      if (t.id !== 'default' && !this.owned.has(t.id)) {
        this.ui.toast('Je moet dit thema eerst kopen', 'danger');
        return;
      }
      const body = document.body;
      for (const th of this.themes) {
        if (th.cssClass) body.classList.remove(th.cssClass);
      }
      if (t.cssClass) body.classList.add(t.cssClass);
      this.current = id;
      try {
        localStorage.setItem('cookie-themes', JSON.stringify({ unlocked: Array.from(this.unlocked), owned: Array.from(this.owned), current: this.current }));
      } catch (_) {}
      try { if (this.game.soundService) this.game.soundService.playPurchase(); } catch (_) {}
    }

    load(data) {
      if (!data) return;
      try {
        if (data.unlocked) this.unlocked = new Set(data.unlocked);
        if (data.owned) this.owned = new Set(data.owned);
        if (data.current) this.current = data.current;
        // apply only if owned or default
        if (this.current && (this.current === 'default' || this.owned.has(this.current))) this.applyTheme(this.current);
      } catch (_) {}
    }

    reset() {
      this.unlocked = new Set(['default']);
      this.owned = new Set(['default']);
      this.current = 'default';
      for (const th of this.themes) if (th.cssClass) document.body.classList.remove(th.cssClass);
    }
  }

  // Simple WebAudio-based sound service
  class SoundService {
    constructor(game) {
      this.game = game;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        this.ctx = null;
      }
    }

    playTone(freq, time = 0.08, type = 'sine') {
      if (!this.ctx) return;
      if (!this.game.settings || !this.game.settings.soundEnabled) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.connect(g);
      g.connect(this.ctx.destination);
      g.gain.value = 0.0001;
      const now = this.ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.001, now + time);
      o.stop(now + time + 0.02);
    }
    // playClick / playPurchase: short helper wrappers to play preset tones
    playClick() { this.playTone(880, 0.06, 'sine'); }
    playPurchase() { this.playTone(440, 0.12, 'triangle'); }
  }

  window.addEventListener("DOMContentLoaded", () => {
    const game = new CookieClickerGame();
    // show start screen and wait for user to press Play
    if (game.ui && typeof game.ui.showStartScreen === 'function') {
      // mount UI so start/settings buttons exist
      game.ui.mount();
      // populate settings UI sound toggle from saved settings
      if (game.ui.writeSettingsToUI) game.ui.writeSettingsToUI();
      game.ui.showStartScreen();
    } else {
      // fallback: start immediately
      game.start();
    }
  });
})();

