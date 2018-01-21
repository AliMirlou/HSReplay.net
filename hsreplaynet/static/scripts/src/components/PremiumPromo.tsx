import React from "react";

interface PremiumPromoProps extends React.ClassAttributes<PremiumPromo> {
	imageName: string;
	text: string | JSX.Element;
}

export default class PremiumPromo extends React.Component<
	PremiumPromoProps,
	{}
> {
	render(): JSX.Element {
		return (
			<div className="premium-promo">
				<div className="premium-background">
					<img
						src={
							STATIC_URL +
							`images/premium-promotional/${this.props.imageName}`
						}
					/>
				</div>
				<div className="card text-center">
					<h3>
						<span className="text-premium">Premium</span> only
					</h3>
					<p className="big">{this.props.text}</p>
					<p>
						<a
							href="/premium/"
							className="btn promo-button hero-button"
						>
							Learn more
						</a>
					</p>
				</div>
			</div>
		);
	}
}
