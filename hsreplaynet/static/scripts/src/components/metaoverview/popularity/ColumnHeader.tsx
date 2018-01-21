import React from "react";
import { ArchetypeRankData, SortDirection } from "../../../interfaces";
import SortIndicator from "../../SortIndicator";

interface ColumnHeaderProps extends React.ClassAttributes<ColumnHeader> {
	active: boolean;
	direction: SortDirection;
	rankData: ArchetypeRankData;
	sortKey: string;
	style?: any;
	onClick?: (key: string, direction: SortDirection) => void;
}

interface ColumnHeaderState {
}

export default class ColumnHeader extends React.Component<ColumnHeaderProps, ColumnHeaderState> {
	render() {
		const imageName = "Medal_Ranked_" + (this.props.rankData.rank || "Legend");
		return (
			<div
				className="matchup-column-header"
				style={this.props.style}
				onClick={(event) => {
					if (event && event.currentTarget) {
						event.currentTarget.blur();
					}
					this.props.onClick(this.props.sortKey, this.getNextDirection());
				}}
				onKeyPress={(event) => {
					if (event.which === 13) {
						this.props.onClick(this.props.sortKey, this.getNextDirection());
					}
				}}
			>
				<img
					className="rank-icon"
					src={`${STATIC_URL}images/64x/ranked-medals/${imageName}.png`}
				/>
				{this.props.rankData.rank ? "Rank " + this.props.rankData.rank : "Legend"}
				<SortIndicator direction={this.props.active ? this.props.direction : null} />
			</div>
		);
	}

	getNextDirection(): SortDirection {
		if (!this.props.active) {
			return "descending";
		}
		return this.props.direction === "ascending" ? "descending" : "ascending";
	}
}
