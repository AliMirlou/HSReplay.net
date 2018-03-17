import React from "react";
import { image } from "../../helpers";

interface Props {
	classNames: string[];
	onClick: () => void;
	rank: number;
}

export default class RankSelector extends React.Component<Props> {
	public render(): React.ReactNode {
		const { rank } = this.props;
		const classNames = ["rank-selector"].concat(this.props.classNames);
		const rankStr = rank === 0 ? "Legend" : rank;
		return (
			<div className={classNames.join(" ")} onClick={this.props.onClick}>
				<img
					src={image(`64x/ranked-medals/Medal_Ranked_${rankStr}.png`)}
				/>
				<span>{rankStr}</span>
			</div>
		);
	}
}
