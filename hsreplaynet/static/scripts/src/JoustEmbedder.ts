import * as Joust from "joust";
import Raven from "raven-js";
import {joustAsset, cardArt} from "./helpers";
import MetricsReporter from "./metrics/MetricsReporter";
import BatchingMiddleware from "./metrics/BatchingMiddleware";
import InfluxMetricsBackend from "./metrics/InfluxMetricsBackend";
import * as React from "react";
import {Launcher} from "joust";

export default class JoustEmbedder {
	public turn: number = null;
	public reveal: boolean = null;
	public swap: boolean = null;
	public locale: string = "enUS";
	public launcher: Launcher = null;
	private target: HTMLElement = null;
	private url: string = null;
	public onTurn: (turn: number) => void = null;
	public onToggleSwap: (swap: boolean) => void = null;
	public onToggleReveal: (reveal: boolean) => void = null;

	public embed(target: HTMLElement) {
		this.prepare(target);
		this.render();
	}

	public prepare(target: HTMLElement) {
		// find container
		if (!target) {
			throw new Error("No target specified");
		}

		if (!Joust.launcher) {
			console.error("Could not load Joust");
			target.innerHTML = '<p class="alert alert-danger">' +
				'<strong>Loading failed:</strong> ' +
				'Replay applet (Joust) could not be loaded. Please ensure you can access ' +
				'<a href="' + JOUST_STATIC_URL + 'joust.js">' + JOUST_STATIC_URL + 'joust.js</a>.</p>' +
				'<p>Otherwise try clearing your cache and refreshing this page.</p>';
			// could also offer document.location.reload(true)
			return;
		}

		const launcher: Launcher = Joust.launcher(target);
		this.launcher = launcher;
		const release = Joust.release();

		// setup RavenJS/Sentry
		let logger = null;
		let dsn = JOUST_RAVEN_DSN_PUBLIC;
		if (dsn) {
			let raven = Raven.config(dsn, {
				release: release,
				environment: JOUST_RAVEN_ENVIRONMENT || "development",
			}).install();
			let username = document.body.getAttribute("data-username");
			if (username) {
				raven.setUserContext({
					username: username,
				});
			}
			(raven as any).setTagsContext({
				react: React.version,
			});
			logger = (err: string|Error) => {
				if (raven) {
					if (typeof err === "string") {
						raven.captureMessage(err);
					}
					else {
						raven.captureException(err);
					}
				}
				let message = err["message"] ? err["message"] : err;
				console.error(message);
			};
			launcher.logger(logger);
		}

		// setup graphics
		launcher.assets((asset: string) => joustAsset(asset));
		launcher.cardArt((cardId: string) => cardArt(cardId));

		// setup metadata
		launcher.metadataSource((build, locale) => HEARTHSTONEJSON_URL.replace(/%\(build\)s/, "" + build).replace(/%\(locale\)s/, locale));
		if (typeof launcher.selectedLocale !== "undefined" && !launcher.selectedLocale) {
			launcher.locale(this.locale);
		}

		// setup influx
		let endpoint = INFLUX_DATABASE_JOUST;
		if (endpoint) {
			// track startup time
			let realtimeElapsed = 0;
			let startupTime = null;
			let measuring = true;
			if ("visibilityState" in document) {
				measuring = document.visibilityState === "visible";
				document.addEventListener("visibilitychange", () => {
					if (measuring && startupTime) {
						realtimeElapsed += Date.now() - startupTime;
					}
					measuring = document.visibilityState === "visible";
					startupTime = Date.now();
				});
			}
			let metrics = null;
			let track = (series, values, tags) => {
				if (!tags) {
					tags = {};
				}
				tags["release"] = release;
				tags["locale"] = this.locale;
				if (series === "startup") {
					startupTime = Date.now();
				}
				metrics.writePoint(series, values, tags);
			};
			metrics = new MetricsReporter(
				new BatchingMiddleware(new InfluxMetricsBackend(endpoint), (): void => {
					let values = {
						percentage: launcher.percentageWatched,
						seconds: launcher.secondsWatched,
						duration: launcher.replayDuration,
						realtime: undefined,
					};
					if (measuring && startupTime) {
						realtimeElapsed += Date.now() - startupTime;
						values.realtime = realtimeElapsed / 1000;
					}
					metrics.writePoint("watched", values, {
						realtime_fixed: 1,
					});
				}),
				(series: string): string => "joust_" + series
			);
			launcher.events(track);
		}

		// turn linking
		if (this.turn !== null) {
			launcher.startAtTurn(this.turn);
		}
		launcher.onTurn((newTurn: number) => {
			this.turn = newTurn;
			this.onTurn && this.onTurn(newTurn);
		});

		if (this.reveal !== null) {
			launcher.startRevealed(this.reveal);
		}
		launcher.onToggleReveal((newReveal: boolean) => {
			this.reveal = newReveal;
			this.onToggleReveal && this.onToggleReveal(newReveal);
		});

		if (this.swap !== null) {
			launcher.startSwapped(this.swap);
		}
		launcher.onToggleSwap((newSwap: boolean) => {
			this.swap = newSwap;
			this.onToggleSwap && this.onToggleSwap(newSwap);
		});

		// autoplay
		let autoplay = target.getAttribute("data-autoplay");
		if (autoplay == "false") {
			// Only disable autoplay if it's *specifically* set to "false"
			launcher.startPaused(true);
		}
		else {
			launcher.startPaused(false);
		}

		// hint at player names
		if (typeof launcher.addPlayerName === "function") {
			for (let i = 1; true; i++) {
				const key = "data-player" + i;
				if (!target.hasAttribute(key)) {
					break;
				}
				const playerName = target.getAttribute(key);
				launcher.addPlayerName(playerName);
			}
		}

		// initialize joust
		let url = target.getAttribute("data-replayurl");
		if (!url.match(/^http(s?):\/\//) && !url.startsWith("/")) {
			url = "/" + url;
		}
		this.url = url;
	}

	public render() {
		if (!this.url) {
			throw new Error("Not prepared"); // you are
		}
		this.launcher.fromUrl(this.url);
	}
}
