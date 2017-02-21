import * as React from "react";
import GameHistoryItem from "./GameHistoryItem";
import {GameReplay, CardArtProps, ImageProps, GlobalGamePlayer} from "../../interfaces";
import {PlayState} from "../../hearthstone";

interface GameHistoryListProps extends ImageProps, CardArtProps, React.ClassAttributes<GameHistoryList> {
	games: GameReplay[];
}

export default class GameHistoryList extends React.Component<GameHistoryListProps, void> {

	render(): JSX.Element {
		let columns = [];
		this.props.games.forEach((game: GameReplay, i: number) => {
			var startTime: Date = new Date(game.global_game.match_start);
			var endTime: Date = new Date(game.global_game.match_end);
			if (i > 0) {
				if (!(i % 2)) {
					columns.push(<div className="clearfix visible-sm-block"/>);
				}
				if (!(i % 3)) {
					columns.push(<div className="clearfix visible-md-block"/>);
				}
				if (!(i % 4)) {
					columns.push(<div className="clearfix visible-lg-block"/>);
				}
			}

			let players = [];
			if (game.friendly_player) {
				players.push(game.friendly_player);
			}
			if (game.opposing_player) {
				players.push(game.opposing_player);
			}

			columns.push(
				<GameHistoryItem
					key={i}
					cardArt={this.props.cardArt}
					image={this.props.image}
					shortid={game.shortid}
					startTime={startTime}
					endTime={endTime}
					gameType={game.global_game.game_type}
					disconnected={game.disconnected}
					scenarioId={game.global_game.scenario_id}
					turns={game.global_game.num_turns}
					won={GameHistoryList.hasWon(game.friendly_player, game.opposing_player)}
					friendlyPlayer={game.friendly_player}
					opposingPlayer={game.opposing_player}
				/>
			);
		});
		return (
			<div className="row">
				{columns}
			</div>
		);
	}

	public static hasWon(friendly_player: GlobalGamePlayer, opposing_player: GlobalGamePlayer): boolean|null {
		if (!friendly_player) {
			return null;
		}
		if ([PlayState.WINNING, PlayState.WON].indexOf(friendly_player.final_state) !== -1) {
			return true;
		}
		if ([PlayState.LOSING, PlayState.LOST].indexOf(friendly_player.final_state) !== -1) {
			return false;
		}
		return null;
	}
}
