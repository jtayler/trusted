# Introduction: Trust and Safety

This demo showcases the TruAnon APIs and their ability to quickly establish trust and prevent abuse on your service. The demo is a simple Node.js application that enables users to sign up, log in, and edit their profile data. Additionally, it features a 'Switch' that allows users to turn on or off the 'badge-of-trust' feature, which is available on all user profiles.

By demonstrating how easy it is to use TruAnon, this demo highlights the advantages of using this identity verification option. Members appreciate the simplicity and effectiveness of TruAnon, making it their preferred choice above all other options or offerings

The TruAnon APIs allow access to data containing information about the owners of profiles on your website. This document provides instructions on how to use these APIs to display information, including a 'badge-of-trust,' which enhances and amplifies user profiles for safer and more effective interactions. The API data is provided in JSON format, and proper parsing and decoding are required to present the data correctly.

## JSON Parsing and Decoding

1. The profile view page needs to display an identity owner’s choice of public information. The badge-of-trust, along with the photo border are expected to indicate a border that matches their author rank, which can be Dangerous, Cautioned, Credible, Reliable, or Genuine. This rank is provide along with a score you can use as a credible identity requirement or visual indicator of trust.
2. To parse the JSON data returned from the API, first, it needs to be encoded using `encodeURIComponent()`. Then, it needs to be parsed using `JSON.parse()` and this unparsing must happen twice. The result is a JSON object containing `verifiedDetails`, which can be accessed using `verifiedDetails.authorRank` dot notation.
3. The `getPhotoBorderColor()` function receives a user's rank and returns a CSS class to add to color the profile picture's border and badge-of-trust. This class sets the color of the border to the user's corresponding rank color.
4. Note that the  `verifiedDetails` array contains dictionaries of matching data points you can display and use. The parsing and decoding of this are especially noteworthy but the concept is very simple; display more and ask less of your users.


## API Usage

To use TruAnon APIs, an HTTP GET request must be sent to the desired endpoint. For example, to get a user's verified details, the following get_profile endpoint should be used: `truanon.com/api/get_profile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]`. This single endpoint is the primary way to interact with TruAnon.

The response contains the user's verified details, including their author rank, which can be used to determine the color of their profile badge-of-trust color. The response needs to be parsed and decoded properly to get the necessary data.

To populate data on the profile view page, jQuery can be used to select the desired elements by their ID and change their text or attributes. For example, to change the profile picture's border color, the jQuery `.addClass()` method can be used to add the CSS class returned by the `getPhotoBorderColor()` function to the profile picture's element.


## Route 1: Get User Profile

The first route, defined with `app.get('/users/:username', ...)`, retrieves a user's profile from the TruAnon API if the user's `switch_state` is set to `true`. Here's how the code works:

1. The route extracts the `username` parameter from the request URL and the `userId` from the session.
2. It then queries the database to retrieve the user's data using their `username`.
3. If the user is found, the route checks their `switch_state` property. If it is set to `true`, the route constructs a URL to fetch the user's profile data from the TruAnon API. It includes the `username` and `service` parameters, as well as the `Authorization` header, which is set to a private key.
4. The route then calls the `truanon.com/api/get_profile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]` endpoint to make a GET request to the TruAnon API using the constructed URL and the `tokenOptions` object that contains the `Authorization` header.

## Route 2: Get User Token

The second route, defined with `app.get('/users/:username/token', ...)`, generates a token for a user using the TruAnon API. This operation securly connects the user via public hyperlink and expiring token and this process happens only once. Here's how the code works:

1. The route extracts the `username` parameter from the request URL.
2. It then constructs a URL to fetch the user's token from the TruAnon API. It includes the `username` and `service` parameters, as well as the `Authorization` header, which is set to a private key.
3. The route then calls the `truanon.com/api/get_token?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]` function to make a GET request to the TruAnon API using the constructed public "smart link" URL and associated options object that contains the `Authorization` header.
4. The `fetch` function returns a Promise that resolves to the response object. The route uses the `json` method of the response object to parse the JSON data and obtain the user's expiring token.
5. The route then sends a JSON response with the user's token and this securely assigns ownership of that identity with the requesting service's unique username identifier.

## How to Use the Token to Create a Public Confirmation Link

After fetching the token using the get_token endpoint, you can use it to create a public confirmation link. This link can be displayed as a button or a link on your website or social media profile to allow others to confirm ownership of your account or profile. This token will expire if the user does not use it.

To create the public confirmation link, use the following URL format: `https://staging.truanon.com/api/verifyProfile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]&token=[YOUR_TOKEN]`

The resulting link will open a popup window where the user can securely confirm ownership of your account or profile. This link is a one-time use only and will expire after the user confirms ownership.

To use this link, display it as a button or a link on your website or social media profile. When the user clicks the link, the popup window will open, and they can confirm ownership of your account or profile.

For example, here is how you can create a link with a popup window: `<a href="https://staging.truanon.com/api/verifyProfile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]&token=[YOUR_TOKEN]" target="ta-popup" width="480" height="820" top="327.5" left="397">Confirm Ownership</a>` In this example, the target="ta-popup" attribute will open the link in a popup window with the specified width, height, top, and left values.

## Conclusion

Get faster onboarding with a convenient way to access confirmed user data for display in any way that is useful. Proper use of JSON parsing and decoding is necessary to ensure the data is used correctly, and the data can be populated on the page through the correct implementation of jQuery

In both routes, the `fetch` function is used to make requests to the TruAnon API. The `Authorization` header is set to a private key, which is passed in via environment variable.
