var JoustExtra = {
	_options: {
		hearthstonejson: null,
		locale: "enUS"
	},

	setup: function (options) {
		Object.keys(options).forEach(function (k) {
			this._options[k] = options[k];
		}.bind(this));
		return this;
	},

	metadata: function (buildNumber, callback) {
		buildNumber = +buildNumber;

		var fetchLatest = function () {
			this._fetchMetadata("latest", function (result) {
				callback(JSON.parse(result));
			});
		};

		if (buildNumber) {
			var key = "hsjson-build-" + buildNumber;

			// check for availablity
			if (typeof(Storage) !== "undefined") {
				// check if already exists
				if (typeof localStorage[key] === "string") {
					var result = JSON.parse(localStorage[key]);
					if (typeof result === "object" && +result.length > 0) {
						callback(result);
						return;
					}
				}

				// clear invalid data
				if (typeof localStorage[key] !== "undefined") {
					console.warn("Removing invalid card data in local storage");
					localStorage.removeItem(key);
				}
			}

			// fetch data
			this._fetchMetadata(buildNumber,
				function (result) {
					// success
					callback(JSON.parse(result));

					// save to storage
					if (key != null && typeof(Storage) !== "undefined") {
						localStorage.setItem(key, result);
					}
				},
				fetchLatest
			);
		}
		else {
			fetchLatest();
		}
	},

	_fetchMetadata: function (buildNumber, successCallback, errorCallback) {
		if (!this._options.hearthstonejson) {
			throw new Error('HearthstoneJSON url was not supplied');
		}
		var url = this._options.hearthstonejson.replace(/%\(build\)s/, buildNumber).replace(/%\(locale\)s/, this._options.locale);
		$.ajax(url, {
			type: "GET",
			dataType: "text",
			success: successCallback,
			error: function (xhr, status, error) {
				if (!xhr.status) {
					// request was probably cancelled
					return;
				}
				if (buildNumber != "latest") {
					this._options.logger && this._options.logger(
						"HearthstoneJSON: Error fetching build " + buildNumber + '\n"' + url + '" returned status ' + xhr.status,
						{hearthstonejson_url: url}
					);
				}
				else {
					throw new Error('HearthstoneJSON: Error fetching latest build\n"' + url + '" returned status ' + xhr.status);
				}
				errorCallback && errorCallback();
			}
		});
	}
};

JoustExtra.metadata = JoustExtra.metadata.bind(JoustExtra);
JoustExtra._fetchMetadata = JoustExtra._fetchMetadata.bind(JoustExtra);
