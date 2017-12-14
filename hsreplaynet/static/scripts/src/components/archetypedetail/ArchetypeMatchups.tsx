import * as React from "react";
import ClassMatchup from "../ClassMatchup";
import {ApiArchetype, ApiArchetypePopularity, SortableProps, SortDirection} from "../../interfaces";
import {withLoading} from "../loading/Loading";
import ClassArchetypesTile from "../metaoverview/ClassArchetypesTile";
import CardData from "../../CardData";

interface ArchetypeMatchupsProps extends React.ClassAttributes<ArchetypeMatchups> {
	archetypeId: number;
	archetypeMatchupData?: any;
	archetypeData?: any;
	cardData?: CardData;
	gameType?: string;
	minGames?: number;
}

interface ArchetypeMatchupsState {
	sortBy: string;
	sortDirection: SortDirection;
}

class ArchetypeMatchups extends React.Component<ArchetypeMatchupsProps, ArchetypeMatchupsState> {
	constructor(props: ArchetypeMatchupsProps, state: ArchetypeMatchupsState) {
		super(props, state);
		this.state = {
			sortBy: "archetype",
			sortDirection: "ascending",
		};
	}

	render(): JSX.Element {
		const {archetypeMatchupData, archetypeId, minGames} = this.props;

		const opponentClasses: {[key: string]: ApiArchetypePopularity[]} = {};
		const games: {[key: string]: number} = {};
		Object.keys(archetypeMatchupData).forEach((opponentId) => {
			const opponentArchetype = this.getArchetype(+opponentId);
			if (opponentArchetype) {
				const opponentClass = opponentArchetype.player_class_name;
				const matchup = archetypeMatchupData[opponentId];
				if (matchup.total_games < (minGames || 0)) {
					return;
				}
				if (!opponentClasses[opponentClass]) {
					opponentClasses[opponentClass] = [];
				}
				games[opponentClass] = (games[opponentClass] || 0) + matchup.total_games;
				opponentClasses[opponentClass].push({
					archetype_id: +opponentArchetype.id,
					pct_of_class: matchup.total_games,
					pct_of_total: 0,
					total_games: matchup.total_games,
					win_rate: matchup.win_rate,
				});
			}
		});

		if (Object.keys(opponentClasses).length === 0) {
			return <h3 className="message-wrapper">Not enough games for meaningful matchup data available.</h3>;
		}

		Object.keys(opponentClasses).forEach((key) => {
			opponentClasses[key].forEach((data) => {
				data.pct_of_class *= 100.0 / games[key];
			});
		});

		const tiles = Object.keys(opponentClasses).sort().map((key) => (
			<ClassArchetypesTile
				archetypeData={this.props.archetypeData}
				cardData={this.props.cardData}
				data={opponentClasses[key]}
				gameType={this.props.gameType}
				onSortChanged={(sortBy: string, sortDirection: SortDirection) => {
					this.setState({sortBy, sortDirection});
				}}
				playerClass={key}
				sortBy={this.state.sortBy}
				sortDirection={this.state.sortDirection}
			/>
		));

		return (
			<div className="class-tile-container">
				{tiles}
			</div>
		);
	}

	getArchetype(archetypeId: number): ApiArchetype {
		return this.props.archetypeData.find((x) => x.id === archetypeId);
	}
}

export default withLoading(["archetypeMatchupData", "archetypeData"])(ArchetypeMatchups);
