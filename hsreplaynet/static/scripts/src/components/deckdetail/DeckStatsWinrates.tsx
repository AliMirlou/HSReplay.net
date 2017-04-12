import * as React from "react";
import { toTitleCase } from "../../helpers";
import { TableData } from "../../interfaces";

interface DeckStatsWinratesState {
}

interface DeckStatsWinratesProps {
	data?: TableData;
}

export default class DeckStatsWinrates extends React.Component<DeckStatsWinratesProps, DeckStatsWinratesState> {
	constructor(props: DeckStatsWinratesProps, state: DeckStatsWinratesState) {
		super(props, state);
		this.state = {
		};
	}

	render(): JSX.Element {
		const data = Object.assign({}, this.props.data.series.data);
		const keys = Object.keys(this.props.data.series.data);
		keys.sort((a, b) => data[a][0]["player_class"] > data[b][0]["player_class"] ? 1 : -1);
		const winrates = [];
		keys.forEach((key) => {
			const winrate = +data[key][0]["win_rate"];
			winrates.push(
				<li>
					vs. {toTitleCase(data[key][0]["player_class"])}
					<span className="infobox-value">{(+winrate).toFixed(1) + "%"}</span>
				</li>,
			);
		});
		return <ul>{winrates}</ul>;
	}
}
