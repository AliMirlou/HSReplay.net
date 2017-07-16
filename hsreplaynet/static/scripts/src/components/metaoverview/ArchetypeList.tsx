
import * as React from "react";
import SortHeader from "../SortHeader";
import CardData from "../../CardData";
import {AutoSizer, Grid} from "react-virtualized";
import {ApiArchetype, ArchetypeData, SortDirection} from "../../interfaces";
import RowHeader from "./RowHeader";
import RowFooter from "./RowFooter";
import ArchetypeSearch from "../ArchetypeSearch";
import PopularityCell from "./popularity/PopularityCell";

interface ArchetypeListProps extends React.ClassAttributes<ArchetypeList> {
	archetypes: ArchetypeData[];
	allArchetypes: ApiArchetype[];
	cardData: CardData;
	favorites: number[];
	maxPopularity?: number;
	onFavoriteChanged: (archetypeId: number, favorite: boolean) => void;
	onSortChanged: (sortBy: string, sortDirection: SortDirection) => void;
	sortBy: string;
	sortDirection: SortDirection;
}

interface ArchetypeListState {
}

const offWhite = "#fbf7f6";

export default class ArchetypeList extends React.Component<ArchetypeListProps, ArchetypeListState> {
	private rowHeaders: Grid = null;
	private popularityCells: Grid = null;
	private winrateCells: Grid = null;

	render() {
		const archetypes = this.props.archetypes;

		const headerCellHeight = 40;
		const cellWidth = 80;
		const cellHeight = 40;
		const spacerSize = 5;

		return (
			<div
				className="archetype-matrix-container"
				style={{
					height: (this.props.archetypes.length * cellHeight + headerCellHeight) + "px",
					margin: "15px 10px",
				}}
			>
				<ArchetypeSearch
					availableArchetypes={this.props.allArchetypes.slice().sort((a, b) => a.name > b.name ? 1 : -1)}
					onArchetypeSelected={(archetype) => this.props.onFavoriteChanged(archetype.id, true)}
				/>
				<AutoSizer>
					{({width}) => (
						<div className="matchup-matrix">
							<div
								className="matchup-header-cell matchup-header-top-left matchup-header-archetype"
								style={{height: headerCellHeight, width: width - 2 * cellWidth, top: headerCellHeight}}
							>
								{this.getSortHeader("class", "Archetype", "ascending")}
							</div>
							<div
								className="matchup-header-cell matchup-header-top-right"
								style={{height: headerCellHeight, width: cellWidth, right: cellWidth, top: headerCellHeight}}
							>
								{this.getSortHeader(
									"popularity",
									"Pop.",
									null,
									"Popularity on Ladder",
									"The percentage of decks played that belong to this archetype.",
								)}
							</div>
							<div
								className="matchup-header-cell matchup-header-top-right"
								style={{height: headerCellHeight, width: cellWidth, top: headerCellHeight}}
							>
								{this.getSortHeader(
									"winrate",
									"EWR",
									null,
									"Effective Winrate",
									"The expected winrate against all active archetypes, weighted by their popularity.",
								)}
							</div>
							<div className="grid-container grid-container-left" style={{top: headerCellHeight * 2}}>
								<Grid
									cellRenderer={({key, rowIndex, style}) => {
										const archetype = archetypes[rowIndex];
										const isFavorite = this.props.favorites.indexOf(archetype.id) !== -1;

										if (this.isLastFavorite(rowIndex)) {
											style["border-bottom"] = spacerSize + "px solid " + offWhite;
										}

										return (
											<RowHeader
												archetypeData={archetype}
												isFavorite={isFavorite}
												onFavoriteChanged={(favorite: boolean) => {
													this.props.onFavoriteChanged(archetype.id, favorite);
													this.recomputeGridSize();
												}}
												cardData={this.props.cardData}
												key={key}
												style={style}
											/>
										);
									}}
									width={width - 2 * cellWidth}
									height={archetypes.length * cellHeight}
									columnCount={2}
									columnWidth={width - 2 * cellWidth}
									rowCount={archetypes.length}
									rowHeight={({index}) => cellHeight + (this.isLastFavorite(index) ? spacerSize : 0)}
									className={"matchup-header"}
									ref={(ref) => this.rowHeaders = ref}
								/>
							</div>
							<div className="grid-container grid-container-right" style={{top: headerCellHeight * 2}}>
								<Grid
									cellRenderer={({columnIndex, key, rowIndex, style}) => {
										if (this.isLastFavorite(rowIndex)) {
											style["border-bottom"] = spacerSize + "px solid " + offWhite;
										}
										if (columnIndex % 2 === 0) {
											return (
												<PopularityCell
													popularity={this.props.archetypes[rowIndex].popularityTotal}
													maxPopularity={this.props.maxPopularity}
													key={key}
													style={style}
												/>
											);
										}
										return (
											<RowFooter
												archetypeData={archetypes[rowIndex]}
												key={key}
												style={style}
											/>
										);
									}}
									width={2 * cellWidth}
									height={archetypes.length * cellHeight}
									columnCount={2}
									columnWidth={cellWidth}
									rowCount={archetypes.length}
									rowHeight={({index}) => cellHeight + (this.isLastFavorite(index) ? spacerSize : 0)}
									className={"matchup-header"}
									ref={(ref) => this.winrateCells = ref}
								/>
							</div>
						</div>
					)}
				</AutoSizer>
			</div>
		);
	}

	recomputeGridSize() {
		this.rowHeaders && this.rowHeaders.recomputeGridSize();
		this.popularityCells && this.popularityCells.recomputeGridSize();
		this.winrateCells && this.winrateCells.recomputeGridSize();
	}

	isLastFavorite(index: number) {
		return index === this.props.favorites.length - 1;
	}

	getSortHeader(
		key: string,
		text: string,
		direction?: SortDirection,
		infoHeader?: string,
		infoText?: string,
	): JSX.Element {
		return (
			<SortHeader
				active={this.props.sortBy === key}
				defaultSortDirection={direction || "descending"}
				direction={this.props.sortDirection}
				sortKey={key}
				text={text}
				onClick={this.props.onSortChanged}
				classNames={["text-center"]}
				infoHeader={infoHeader}
				infoText={infoText}
				element={<div />}
			/>
		);
	}
}
