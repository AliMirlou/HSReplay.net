import React from "react";

export type Mode = "add" | "set";

interface RowSelectorProps extends React.ClassAttributes<RowSelector> {
	classNames: string[];
	onClick: (mode: Mode) => void;
	mode: Mode;
}

export default class RowSelector extends React.Component<RowSelectorProps, {}> {
	render(): JSX.Element {
		const { mode } = this.props;
		const classNames = ["row-selector"].concat(this.props.classNames);
		const glyphicon = mode === "add" ? "plus" : "arrow-right";
		return (
			<div
				className={classNames.join(" ")}
				onClick={() => this.props.onClick(mode)}
			>
				<span className={`glyphicon glyphicon-${glyphicon}`} />
			</div>
		);
	}
}
