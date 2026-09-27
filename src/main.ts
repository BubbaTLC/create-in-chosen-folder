import { around } from "monkey-around";
import { App, getLinkpath, normalizePath, Notice, Plugin, PluginSettingTab, Setting, SuggestModal, TFile, Workspace } from "obsidian";

type OpenLinkText = Workspace["openLinkText"];

interface CreateInChosenFolderSettings {
	recentCount: number;
}

const DEFAULT_SETTINGS: CreateInChosenFolderSettings = {
	recentCount: 5,
};

const NEW_FOLDER_PREFIX = "\u0000new:";

class FolderPickerModal extends SuggestModal<string> {
	private chosen = false;

	constructor(
		app: App,
		noteName: string,
		private recentCount: number,
		private onPick: (folder: string | null) => void,
	) {
		super(app);
		this.setPlaceholder(`Choose a folder for "${noteName}" (type a new path to create it)`);
		this.setInstructions([
			{ command: "↑↓", purpose: "navigate" },
			{ command: "↵", purpose: "create note here" },
			{ command: "esc", purpose: "cancel" },
		]);
	}

	private recent = new Set<string>();

	getSuggestions(query: string): string[] {
		const q = query.trim().toLowerCase();
		const allFolders = this.app.vault.getAllFolders(true);

		const lastCreated = new Map<string, number>();
		for (const folder of allFolders) {
			let newest = 0;
			for (const child of folder.children) {
				if (child instanceof TFile) newest = Math.max(newest, child.stat.ctime);
			}
			if (newest > 0) lastCreated.set(folder.path, newest);
		}

		const recent = [...lastCreated.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, this.recentCount)
			.map(([path]) => path);
		this.recent = new Set(recent);

		const alphabetical = allFolders
			.map((f) => f.path)
			.filter((p) => !this.recent.has(p))
			.sort((a, b) => a.localeCompare(b));

		const folders = [...recent, ...alphabetical];
		const matches = folders.filter((p) => p.toLowerCase().includes(q));

		const typed = normalizePath(query.trim());
		if (query.trim() && !folders.some((p) => p.toLowerCase() === typed.toLowerCase())) {
			matches.push(NEW_FOLDER_PREFIX + typed);
		}
		return matches;
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		if (value.startsWith(NEW_FOLDER_PREFIX)) {
			el.setText(`➕ Create folder "${value.slice(NEW_FOLDER_PREFIX.length)}"`);
		} else {
			el.setText(value === "/" ? "/ (vault root)" : value);
			if (this.recent.has(value)) {
				el.createSpan({ text: "recent", cls: "create-in-chosen-folder-recent" });
			}
		}
	}

	onChooseSuggestion(value: string): void {
		this.chosen = true;
		this.onPick(value);
	}

	onClose(): void {
		super.onClose();
		// onChooseSuggestion fires after onClose, so defer the cancel check.
		setTimeout(() => {
			if (!this.chosen) this.onPick(null);
		}, 0);
	}
}

export default class CreateInChosenFolderPlugin extends Plugin {
	settings: CreateInChosenFolderSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new CreateInChosenFolderSettingTab(this.app, this));

		const plugin = this;
		this.register(
			around(this.app.workspace, {
				openLinkText(original: OpenLinkText): OpenLinkText {
					return async function (this: Workspace, linktext, sourcePath, newLeaf, openViewState) {
						const linkpath = getLinkpath(linktext);
						const exists = plugin.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
						if (exists || !linkpath) {
							return original.call(this, linktext, sourcePath, newLeaf, openViewState);
						}
						const created = await plugin.promptAndCreate(linkpath);
						if (!created) return;
						const subpath = linktext.slice(linkpath.length);
						return original.call(this, created + subpath, sourcePath, newLeaf, openViewState);
					};
				},
			}),
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private pickFolder(noteName: string): Promise<string | null> {
		return new Promise((resolve) => new FolderPickerModal(this.app, noteName, this.settings.recentCount, resolve).open());
	}

	/** Returns the created file's path, or null if cancelled. */
	private async promptAndCreate(linkpath: string): Promise<string | null> {
		const baseName = linkpath.split("/").pop() ?? linkpath;
		const choice = await this.pickFolder(baseName);
		if (choice === null) return null;

		let folder = choice.startsWith(NEW_FOLDER_PREFIX) ? choice.slice(NEW_FOLDER_PREFIX.length) : choice;
		folder = folder === "/" ? "" : normalizePath(folder);

		try {
			if (folder && !this.app.vault.getFolderByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			const fileName = baseName.endsWith(".md") ? baseName : `${baseName}.md`;
			const path = normalizePath(folder ? `${folder}/${fileName}` : fileName);
			const file = await this.app.vault.create(path, "");
			return file.path;
		} catch (e) {
			new Notice(`Could not create note: ${e instanceof Error ? e.message : e}`);
			return null;
		}
	}
}

class CreateInChosenFolderSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: CreateInChosenFolderPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Number of recent folders")
			.setDesc("How many folders with the most recently created notes to show at the top of the picker. Set to 0 to disable.")
			.addSlider((slider) =>
				slider
					.setLimits(0, 20, 1)
					.setValue(this.plugin.settings.recentCount)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.recentCount = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
