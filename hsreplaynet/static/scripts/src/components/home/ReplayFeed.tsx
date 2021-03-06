import _ from "lodash";
import React from "react";
import { InjectedTranslateProps, translate } from "react-i18next";
import DataManager from "../../DataManager";
import { BnetGameType } from "../../hearthstone";
import { image } from "../../helpers";
import { Archetype } from "../../utils/api";
import RankIcon from "../RankIcon";
import { withLoading } from "../loading/Loading";
import ScrollingFeed from "./ScrollingFeed";
import { formatNumber } from "../../i18n";

interface ReplayData {
	player1_rank: string;
	player1_legend_rank: string;
	player1_archetype: string;
	player1_won: string;
	player2_rank: string;
	player2_legend_rank: string;
	player2_archetype: string;
	player2_won: string;
	id: string;
}

interface GameCountData {
	games_today: number;
	games_weekly: number;
	contributors_today: number;
	contributors_weekly: number;
}

interface State {
	data: ReplayData[];
	doUpdate: boolean;
	fetching: boolean;
	lastFetch: Date;
	startTime: number;
}

interface Props extends InjectedTranslateProps {
	archetypeData?: Archetype[];
	gamesCountData?: GameCountData;
	fullSpeed?: boolean;
}

class ReplayFeed extends React.Component<Props, State> {
	private updateInterval: number | null = null;
	private counterRef: HTMLElement | null = null;

	constructor(props: Props, context?: any) {
		super(props, context);
		this.state = {
			data: [],
			fetching: false,
			doUpdate: true,
			lastFetch: new Date(0),
			startTime: this.getMillisecondsOfDay() || 1,
		};
	}

	public componentWillReceiveProps(
		nextProps: Readonly<Props>,
		nextContext: any,
	): void {
		if (
			nextProps.gamesCountData.games_today !==
			this.props.gamesCountData.games_today
		) {
			this.setState({ startTime: this.getMillisecondsOfDay() || 1 });
		}
	}

	public componentDidMount(): void {
		let lastRequest: number | null = null;
		if (typeof window.requestAnimationFrame !== "function") {
			return;
		}
		this.updateInterval = window.setInterval(() => {
			if (lastRequest !== null) {
				window.cancelAnimationFrame(lastRequest);
			}
			lastRequest = window.requestAnimationFrame(() => {
				if (!this.counterRef) {
					return;
				}
				const now = this.getMillisecondsOfDay();
				const factor = now / this.state.startTime;
				const games = Math.floor(this.getAdjustedGamesToday() * factor);
				this.counterRef.innerHTML = formatNumber(games);
			});
		}, 10);
	}

	public componentWillUnmount(): void {
		if (this.updateInterval !== null) {
			window.clearInterval(this.updateInterval);
		}
		this.updateInterval = null;
		this.counterRef = null;
	}

	getMillisecondsOfDay(asUtc: boolean = true): number {
		const now = new Date();
		const utc = asUtc ? "UTC" : "";
		return (
			now[`get${utc}Milliseconds`]() +
			1000 * now[`get${utc}Seconds`]() +
			1000 * 60 * now[`get${utc}Minutes`]() +
			1000 * 60 * 60 * now[`get${utc}Hours`]()
		);
	}

	getAdjustedGamesToday(): number {
		return (
			this.props.gamesCountData.games_today *
			(this.getMillisecondsOfDay(false) / this.getMillisecondsOfDay(true))
		);
	}

	fetchData() {
		if (
			this.state.fetching ||
			new Date().valueOf() - this.state.lastFetch.valueOf() < 5000
		) {
			return;
		}
		this.setState({ fetching: true });
		DataManager.get("/api/v1/live/replay_feed/", {}, true)
			.then((response: any) => {
				if (_.isEmpty(response) || _.isEmpty(response.data)) {
					return Promise.reject("No data");
				}
				return Promise.resolve(response.data);
			})
			.then((data: ReplayData[]) => {
				this.setState({ data, fetching: false, lastFetch: new Date() });
			})
			.catch(error => {
				this.setState({
					doUpdate: false,
					fetching: false,
					lastFetch: new Date(),
				});
			});
	}

	public shouldComponentUpdate(
		nextProps: Readonly<Props>,
		nextState: Readonly<State>,
		nextContext: any,
	): boolean {
		return (
			!_.isEqual(this.props.archetypeData, nextProps.archetypeData) ||
			this.props.fullSpeed !== nextProps.fullSpeed ||
			!_.isEqual(this.state.data, nextState.data) ||
			this.state.doUpdate !== nextState.doUpdate ||
			this.state.fetching !== nextState.fetching
		);
	}

	render(): React.ReactNode {
		const { t } = this.props;
		if (this.state.data === null) {
			return null;
		}
		const items = this.state.data.map(replay => {
			return { id: replay.id, data: replay };
		});
		const gamesPerSecond =
			this.props.gamesCountData.games_today /
			(this.state.startTime / 1000);
		return (
			<>
				<div id="replay-feed">
					<h1>
						{t("Games Last 7 Days:")}{" "}
						{formatNumber(this.props.gamesCountData.games_weekly)}
					</h1>
					<h4>
						{t("Games Today:")}{" "}
						<span
							id="games-count"
							ref={ref => (this.counterRef = ref)}
						>
							{formatNumber(
								Math.floor(this.getAdjustedGamesToday()),
							)}
						</span>
					</h4>
					<ScrollingFeed
						direction="up"
						items={items}
						itemConverter={d => this.itemConverter(d)}
						itemHeight={44}
						onLowItems={() => this.fetchData()}
						lowItemCount={10}
						itemsPerSecond={
							this.props.fullSpeed ? gamesPerSecond : 1.2
						}
					/>
					<div id="replay-contributors">
						{t("Contributors:")}{" "}
						{formatNumber(
							this.props.gamesCountData.contributors_weekly,
						)}
					</div>
					<div id="contributor-button-wrapper">
						<a
							className="btn promo-button blue-style"
							href="/downloads/"
						>
							{t("Become a Contributor")}
						</a>
					</div>
				</div>
			</>
		);
	}

	itemConverter(data: ReplayData): React.ReactNode {
		const winnerIcon = (
			<img className={"winner-icon"} src={image("crown.png")} />
		);
		const p1Archetype = this.props.archetypeData.find(a => {
			return a.id === +data.player1_archetype;
		});
		const p2Archetype = this.props.archetypeData.find(a => {
			return a.id === +data.player2_archetype;
		});
		return (
			<a
				className="replay-feed-item"
				href={`/replay/${data.id}`}
				target="_blank"
			>
				<div className="replay-feed-player player-left">
					{data.player1_won === "True" ? winnerIcon : null}
					<RankIcon
						gameType={BnetGameType.BGT_RANKED_STANDARD}
						rank={+data.player1_rank}
						legendRank={+data.player1_legend_rank}
					/>
					<span>{p1Archetype && p1Archetype.name}</span>
				</div>
				<img className="vs-icon" src={image("vs.png")} />
				<div className="replay-feed-player player-right">
					{data.player2_won === "True" ? winnerIcon : null}
					<RankIcon
						gameType={BnetGameType.BGT_RANKED_STANDARD}
						rank={+data.player2_rank}
						legendRank={+data.player2_legend_rank}
					/>
					<span>{p2Archetype && p2Archetype.name}</span>
				</div>
			</a>
		);
	}
}

export default withLoading(["archetypeData", "gamesCountData"])(
	translate()(ReplayFeed),
);
