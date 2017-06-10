import * as React from "react";

interface CardHighlightTileProps {
	card: any;
	title: string;
	value: string;
	name?: string;
	href?: string;
}

export default class CardHighlightTile extends React.Component<CardHighlightTileProps, void> {
	render(): JSX.Element {
		return (
			<div className="col-xs-12 col-sm-6 col-md-4 col-lg-3">
				<a className="card-highlight-tile" href={this.props.href} style={{backgroundImage: "url(https://art.hearthstonejson.com/v1/512x/" + this.props.card.id + ".jpg"}}>
					<div className="card-info-container">
						<h1>{this.props.title}</h1>
						<p className="card-info-value">{this.props.value || 0}</p>
						<p className="card-info-name">{this.props.card.dbfId !== 1674 && (this.props.name || this.props.card.name) || "None"}</p>
					</div>
				</a>
			</div>
		);
	}
}
