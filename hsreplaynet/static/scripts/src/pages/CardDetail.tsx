import * as React from "react";
import CardData from "../CardData";
import RecommendedDecksList from "../components/carddetail/RecommendedDecksList";
import CardRankingTable from "../components/CardRankingTable";
import CardDetailPieChart from "../components/charts/CardDetailPieChart";
import PopularityLineChart from "../components/charts/PopularityLineChart";
import TurnPlayedBarChart from "../components/charts/TurnPlayedBarChart";
import WinrateByTurnLineChart from "../components/charts/WinrateByTurnLineChart";
import WinrateLineChart from "../components/charts/WinrateLineChart";
import ClassFilter, {FilterOption} from "../components/ClassFilter";
import DataInjector from "../components/DataInjector";
import DataText from "../components/DataText";
import InfoboxFilter from "../components/InfoboxFilter";
import InfoboxFilterGroup from "../components/InfoboxFilterGroup";
import ChartLoading from "../components/loading/ChartLoading";
import HideLoading from "../components/loading/HideLoading";
import TableLoading from "../components/loading/TableLoading";
import PremiumWrapper from "../components/PremiumWrapper";
import DataManager from "../DataManager";
import {
	getChartScheme, getDustCost, isCollectibleCard,
	isWildSet, setNames, toPrettyNumber, toTitleCase,
} from "../helpers";
import {
	RenderData, TableData,
} from "../interfaces";
import InfoboxLastUpdated from "../components/InfoboxLastUpdated";
import InfoIcon from "../components/InfoIcon";
import UserData from "../UserData";
import AdaptDetail from "../components/carddetail/AdaptDetail";
import TabList from "../components/layout/TabList";
import Tab from "../components/layout/Tab";
import Fragments from "../components/Fragments";
import QuestCompletionDetail from "../components/carddetail/QuestCompletionDetail";
import QuestContributors from "../components/carddetail/QuestContributors";

interface TableDataMap {
	[key: string]: TableData;
}

interface RenderDataMap {
	[key: string]: RenderData;
}

interface CardDetailState {
	showInfo?: boolean;
}

interface CardDetailProps {
	card: any;
	cardData: CardData;
	cardId: string;
	dbfId: number;
	gameType?: string;
	opponentClass?: string;
	rankRange?: string;
	setGameType?: (gameType: string) => void;
	setOpponentClass?: (opponentClass: string) => void;
	setRankRange?: (rankRange: string) => void;
	setTab?: (tab: string) => void;
	tab?: string;
	userData: UserData;
}

export default class CardDetail extends React.Component<CardDetailProps, CardDetailState> {
	private readonly dataManager: DataManager = new DataManager();

	constructor(props: CardDetailProps, state: CardDetailState) {
		super(props, state);
		this.state = {
			showInfo: false,
		};
	}

	cardHasTargetReqs(): boolean {
		if (this.props.card && this.props.card.playRequirements) {
			return Object.keys(this.props.card.playRequirements).some((req) => req.toLowerCase().indexOf("target") !== -1);
		}
		return false;
	}

	cardHasDiscover(): boolean {
		const hasDiscover = this.props.card && this.props.card.text
			&& this.props.card.text.indexOf("Discover") !== -1;
		const kalimos = this.props.card && this.props.dbfId === 41331;
		return hasDiscover || kalimos || false;
	}

	cardIsNeutral(): boolean {
		return (this.props.card && this.props.card.playerClass === "NEUTRAL") || false;
	}

	cardHasAdapt(): boolean {
		return (
			this.props.card &&
			this.props.card.referencedTags &&
			this.props.card.referencedTags.indexOf("ADAPT") !== -1
		) || false;
	}

	cardIsQuest(): boolean {
		return (
			this.props.card &&
			this.props.card.mechanics &&
			this.props.card.mechanics.indexOf("QUEST") !== -1
		) || false;
	}

	componentWillReceiveProps(nextProps: CardDetailProps) {
		if (!this.props.card && nextProps.card) {
			if (isWildSet(nextProps.card.set)) {
				this.props.setGameType("RANKED_WILD");
			}
		}
	}

	render(): JSX.Element {
		let content = null;
		if (this.props.card) {
			if (!isCollectibleCard(this.props.card)) {
				content = (
					<div className="message-wrapper">
						<h3>Sorry, we currently don't have statistics for non-collectible cards.</h3>
						<a href="/cards/" className="promo-button">Show available cards</a>
					</div>
				);
			}
			else {
				let utilization = [];
				let cardStatsLoading = false;

				if (utilization.length) {
					const colWidth = 12 / utilization.length;
					utilization = utilization.map((obj) => (
						<div className={"col-lg-" + colWidth + " col-md-" + colWidth}>
							{obj}
						</div>
					));
				}
				else if (cardStatsLoading) {
					utilization.push(<h3 className="message-wrapper">Loading…</h3>);
				}
				else {
					utilization.push(<h3 className="message-wrapper">
						No utilization data for this card available
					</h3>);
				}

				const headerContent = [
					<div className="col-lg-6 col-md-6">
						<div className="chart-wrapper">
							<DataInjector
								dataManager={this.dataManager}
								query={{url: "single_card_stats_over_time", params: this.getParams()}}
							>
								<ChartLoading>
									<PopularityLineChart
										widthRatio={2}
										maxYDomain={100}
									/>
								</ChartLoading>
							</DataInjector>
							<InfoIcon
								header="Popularity over time"
								content="Percentage of decks that include at least one copy of this card."
							/>
						</div>
					</div>,
					<div className="col-lg-6 col-md-6">
						<div className="chart-wrapper">
							<DataInjector
								dataManager={this.dataManager}
								query={{url: "single_card_stats_over_time", params: this.getParams()}}
							>
								<ChartLoading>
									<WinrateLineChart
										widthRatio={2}
									/>
								</ChartLoading>
							</DataInjector>
							<InfoIcon
								header="Winrate over time"
								content="Winrate of decks that include at least one copy of this card."
							/>
						</div>
					</div>,
				];

				const turnStatsQuery = {
					params: this.getParams(),
					url: (
						this.props.opponentClass !== "ALL" && this.props.userData.isPremium()
						? "/analytics/query/single_card_stats_by_turn_and_opponent"
						: "/analytics/query/single_card_stats_by_turn"
					),
				};

				const turnStatsNoDataCondition = (data: RenderData): boolean => {
					if (this.props.opponentClass !== "ALL" && this.props.userData.isPremium()) {
						const selectedSeries = data.series.find((s) => s.metadata.opponent_class === this.props.opponentClass);
						return !selectedSeries || selectedSeries.data.length < 2;
					}
					return data.series[0].data.length < 2;
				};

				const turnCharts = (
					<div className="container-fluid">
						<div className="row">
							<div className="opponent-filter-wrapper">
								<h3>Opponent class</h3>
								<ClassFilter
									filters="All"
									hideAll
									minimal
									selectedClasses={[this.props.opponentClass as FilterOption]}
									selectionChanged={(selected) => this.props.userData.isPremium() && this.props.setOpponentClass(selected[0])}
								/>
							</div>
						</div>
						<div className="row">
							<div className="col-lg-6 col-md-6">
								<div className="chart-wrapper">
									<DataInjector
										dataManager={this.dataManager}
										query={turnStatsQuery}
									>
										<ChartLoading noDataCondition={turnStatsNoDataCondition}>
											<TurnPlayedBarChart
												opponentClass={this.props.opponentClass}
												widthRatio={2}
												premiumLocked={!this.props.userData.isPremium()}
											/>
										</ChartLoading>
									</DataInjector>
									<InfoIcon
										header="Popularity by turn"
										content="Percentage of the time this card is played on a given turn."
									/>
								</div>
							</div>
							<div className="col-lg-6 col-md-6">
								<div className="chart-wrapper">
									<DataInjector
										dataManager={this.dataManager}
										query={turnStatsQuery}
									>
										<ChartLoading noDataCondition={turnStatsNoDataCondition}>
											<WinrateByTurnLineChart
												opponentClass={this.props.opponentClass}
												widthRatio={2}
												premiumLocked={!this.props.userData.isPremium()}
											/>
										</ChartLoading>
									</DataInjector>
									<InfoIcon
										header="Winrate by turn"
										content="Percentage of games won when this card is played on a given turn."
									/>
								</div>
							</div>
						</div>
					</div>
				);

				content = [
					<section id="content-header">
						<h1>{this.props.card && this.props.card.name} - Statistics</h1>
						{headerContent}
					</section>,
					<section id="page-content">
						<Fragments
							defaults={{
								tab: "",
							}}
							keepDefaults={true}
						>
							<TabList tab={this.props.tab} setTab={this.props.setTab}>
								<Tab label="Recommended Decks" id="recommended-decks" disabled={this.isArena()}>
									<DataInjector
										dataManager={this.dataManager}
										query={{
											params: {GameType: this.props.gameType, RankRange: this.props.rankRange},
											url: "list_decks_by_win_rate",
										}}
									>
										<TableLoading>
											<RecommendedDecksList
												card={this.props.card}
												cardData={this.props.cardData}
											/>
										</TableLoading>
									</DataInjector>
								</Tab>
								<Tab
									label={(
										<span className="text-premium">
											Turn Details&nbsp;
											<InfoIcon
												header="Popularity and Winrate by Turn"
												content="Learn when this card is usually played in the different matchups and how that affects the winrate."
											/>
										</span>
									)}
									id="turn-statistics"
								>
									<PremiumWrapper
										name="Single Card Turn Statistics"
										isPremium={this.props.userData.isPremium()}
										iconStyle={{display: "none"}}
									>
										{turnCharts}
									</PremiumWrapper>
								</Tab>
								<Tab label="Class Distribution" id="class-distribution" hidden={!this.cardIsNeutral()}>
									<h3>Class Distribution</h3>
									<div id="class-chart">
										<DataInjector
											dataManager={this.dataManager}
											query={{url: "single_card_class_distribution_by_include_count", params: this.getParams()}}
										>
											<ChartLoading>
												<CardDetailPieChart
													removeEmpty
													scheme={getChartScheme("class")}
													sortByValue
												/>
											</ChartLoading>
										</DataInjector>
									</div>
								</Tab>
								<Tab label="Targets" id="targets" hidden={!this.cardHasTargetReqs()}>
									<div className="card-tables">
										<h3>Most popular targets</h3>
										<DataInjector
											dataManager={this.dataManager}
											query={{url: "single_card_popular_targets", params: this.getParams()}}
											modify={(data) => this.mergeHeroes(data)}
										>
											<TableLoading>
												<CardRankingTable
													cardData={this.props.cardData}
													numRows={12}
													dataKey={"ALL"}
												/>
											</TableLoading>
										</DataInjector>
									</div>
								</Tab>
								<Tab label="Discover" id="discover" hidden={!this.cardHasDiscover()}>
									<div className="card-tables">
										<h3>Most popular Discover choices</h3>
										<DataInjector
											dataManager={this.dataManager}
											query={{url: "single_card_choices_by_winrate", params: this.getParams()}}
										>
											<TableLoading>
												<CardRankingTable
													cardData={this.props.cardData}
													numRows={12}
													dataKey={"ALL"}
													tooltips={{
														popularity: (
															<InfoIcon
																header="Popularity for Discover"
																content="A card's percentage represents how often the card was picked over others if it was available for choice."
															/>
														),
													}}
												/>
											</TableLoading>
										</DataInjector>
									</div>
								</Tab>
								<Tab label="Adapt" id="adapt" hidden={!this.cardHasAdapt()}>
									<DataInjector
										dataManager={this.dataManager}
										query={{
											params: this.getParams(),
											url: (
												this.props.userData.isPremium() && this.props.opponentClass !== "ALL"
													? "single_card_adapt_stats_by_opponent" : "single_card_adapt_stats"
											),
										}}
									>
										<AdaptDetail
											cardData={this.props.cardData}
											opponentClass={this.props.opponentClass}
											setOpponentClass={this.props.setOpponentClass}
											userData={this.props.userData}
										/>
									</DataInjector>
								</Tab>
								<Tab
									label="Quest Contributors"
									id="quest-contributors"
									hidden={
										!this.cardIsQuest()
										|| this.isArena()
										|| !this.props.userData.hasFeature("quest-contributors")
									}
								>
									<DataInjector
										dataManager={this.dataManager}
										query={{params: this.getParams(), url: "quest_contributor_stats"}}
									>
										<QuestContributors
											cardData={this.props.cardData}
										/>
									</DataInjector>
								</Tab>
								<Tab
									label="Quest Completion"
									id="quest-completion"
									hidden={!this.cardIsQuest() || this.isArena()}
								>
									<QuestCompletionDetail
										dataManager={this.dataManager}
										query={{params: this.getParams(), url: "quest_completion_stats_by_turn"}}
									/>
								</Tab>
							</TabList>
						</Fragments>
					</section>,
				];
			}
		}
		else {
			content = <h3 className="message-wrapper">Loading…</h3>;
		}

		let race = null;
		if (this.props.card && this.props.card.race) {
			race = (
				<li>
					Race
					<span className="infobox-value">{toTitleCase(this.props.card.race)}</span>
				</li>
			);
		}

		const dustCostValue = getDustCost(this.props.card);
		const craftingCost = (
			<li>
				Cost
				{this.props.card ? (
					<span className="infobox-value">
						{dustCostValue > 0 ? (dustCostValue + " Dust") : "Not craftable"}
					</span>
				)  : null}
			</li>
		);

		let rankRange = null;
		if (this.props.userData.hasFeature("legend-filter")) {
			rankRange = (
				<PremiumWrapper
					name="Single Card Rank Range"
					isPremium={this.props.userData.isPremium()}
					infoHeader="Rank range"
					infoContent="Check out how this card performs at higher ranks!"
				>
					<h2>Rank range</h2>
					<InfoboxFilterGroup
						locked={!this.props.userData.isPremium()}
						selectedValue={this.props.rankRange}
						onClick={(value) => this.props.setRankRange(value)}
					>
						<InfoboxFilter value="LEGEND_ONLY" disabled={this.isArena()}>Legend only</InfoboxFilter>
						<InfoboxFilter value="LEGEND_THROUGH_FIVE" disabled={this.isArena()}>Legend–5</InfoboxFilter>
						<InfoboxFilter value="LEGEND_THROUGH_TEN" disabled={this.isArena()}>Legend–10</InfoboxFilter>
						<InfoboxFilter value="ALL" disabled={this.isArena()}>Legend–25</InfoboxFilter>
					</InfoboxFilterGroup>
				</PremiumWrapper>
			);
		}

		return <div className="card-detail-container">
			<aside className="infobox" id="card-detail-infobox">
				<img
					className="card-image"
					src={"https://art.hearthstonejson.com/v1/render/latest/enUS/256x/" + this.props.cardId + ".png"}
				/>
				<p>{this.getCleanFlavorText()}</p>
				<InfoboxFilterGroup
					header="Game Mode"
					selectedValue={this.props.gameType}
					onClick={(value) => this.props.setGameType(value)}
				>
					<InfoboxFilter disabled={this.props.card && isWildSet(this.props.card.set)} value="RANKED_STANDARD">
						Ranked Standard
					</InfoboxFilter>
					<InfoboxFilter value="RANKED_WILD">Ranked Wild</InfoboxFilter>
					<InfoboxFilter
						disabled={(this.props.card && isWildSet(this.props.card.set)) || this.cardIsQuest()}
						value="ARENA">
						Arena
					</InfoboxFilter>
				</InfoboxFilterGroup>
				<PremiumWrapper
					name="Single Card Rank Range"
					isPremium={this.props.userData.isPremium()}
					infoHeader="Rank range"
					infoContent="Check out how this card performs at higher ranks!"
				>
					<h2>Rank range</h2>
					<InfoboxFilterGroup
						locked={!this.props.userData.isPremium()}
						selectedValue={this.props.rankRange}
						onClick={(value) => this.props.setRankRange(value)}
						disabled={this.isArena()}
					>
						<InfoboxFilter value="LEGEND_ONLY">Legend only</InfoboxFilter>
						<InfoboxFilter value="LEGEND_THROUGH_FIVE">Legend–5</InfoboxFilter>
						<InfoboxFilter value="LEGEND_THROUGH_TEN">Legend–10</InfoboxFilter>
						<InfoboxFilter value="ALL">Legend–25</InfoboxFilter>
					</InfoboxFilterGroup>
				</PremiumWrapper>
				<h2>Data</h2>
				<ul>
					<li>
						Based on
						<span className="infobox-value">
							<DataInjector
								dataManager={this.dataManager}
								fetchCondition={!!this.props.card && isCollectibleCard(this.props.card)}
								query={{url: "single_card_stats_over_time", params: this.getParams()}}
								modify={(data) => {
									if (data) {
										const series = data.series.find((x) => x.metadata.is_winrate_data);
										return toPrettyNumber(series.metadata.num_data_points) + " replays";
									}
									return null;
								}}
							>
								<HideLoading><DataText /></HideLoading>
							</DataInjector>
						</span>
					</li>
					<InfoboxLastUpdated
						dataManager={this.dataManager}
						fetchCondition={!!this.props.card && isCollectibleCard(this.props.card)}
						url={"single_card_stats_over_time"}
						params={this.getParams()}
					/>
					<li>
						Time frame
						<span className="infobox-value">Last 30 days</span>
					</li>
				</ul>
				<h2>Card</h2>
				<ul>
					<li>
						Class
						<span className="infobox-value">{this.props.card && toTitleCase(this.props.card.playerClass)}</span>
					</li>
					<li>
						Type
						<span className="infobox-value">{this.props.card && toTitleCase(this.props.card.type)}</span>
					</li>
					<li>
						Rarity
						<span className="infobox-value">{this.props.card && toTitleCase(this.props.card.rarity)}</span>
					</li>
					<li>
						Set
						<span className="infobox-value">
							{this.props.card && this.props.card.set && setNames[this.props.card.set.toLowerCase()]}
						</span>
					</li>
					{race}
					{craftingCost}
					<li>
						Artist
						<span className="infobox-value">{this.props.card && this.props.card.artist}</span>
					</li>
				</ul>
			</aside>
			<main>
				{content}
			</main>
		</div>;
	}

	isArena(): boolean {
		return this.props.gameType === "ARENA";
	}

	mergeHeroes(tableData: TableData): TableData {
		if (!this.props.cardData) {
			return tableData;
		}
		const all = [];
		const hero = {dbf_id: -1, popularity: 0};
		tableData.series.data.ALL.forEach((x) => {
			const card = this.props.cardData.fromDbf(x.dbf_id);
			if (card.type === "HERO") {
				hero.popularity += +x.popularity;
			}
			else {
				all.push(x);
			}
		});
		all.push(hero);
		return {series: {data: {ALL: all}}};
	}

	getCleanFlavorText(): string {
		if (!this.props.card || !this.props.card.flavor) {
			return null;
		}
		return this.props.card.flavor.replace("<i>", "").replace("</i>", "");
	}

	getParams(): any {
		const params =  {
			GameType: this.props.gameType,
			card_id: this.props.dbfId,
		};
		if (!this.isArena()) {
			params["RankRange"] = this.props.rankRange;
		}
		return params;
	}
}
