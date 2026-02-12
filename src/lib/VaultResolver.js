/**
 * VaultResolver prefers environment variables and falls back to @git-stunts/vault
 * when available. Dynamic import keeps startup resilient if the published vault
 * package is temporarily broken.
 */
export default class VaultResolver {
  constructor() {
    this.vault = null;
    this.loadError = null;
    this.loadPromise = this.#loadVault();
  }

  async #loadVault() {
    try {
      const mod = await import('@git-stunts/vault');
      const Vault = mod.default;
      this.vault = new Vault();
    } catch (error) {
      this.loadError = error;
    }
  }

  async resolveSecret({ envKey, vaultTarget }) {
    const fromEnv = process.env[envKey];
    if (fromEnv) {
      return fromEnv;
    }

    await this.loadPromise;

    if (!this.vault || typeof this.vault.resolveSecret !== 'function') {
      return null;
    }

    try {
      return this.vault.resolveSecret({ envKey, vaultTarget });
    } catch {
      return null;
    }
  }
}
