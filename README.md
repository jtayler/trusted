# Introduction

TruAnon APIs provide access to the data containing information about users on your website. This document provides details on how to use these APIs to populate data on the profile view page. The data is provided in JSON format, and proper parsing and decoding are necessary to present the data correctly.

## JSON Parsing and Decoding

1. The profile view page needs to display an identity owner’s choice of public information. The badge and photo border are also expected to have a border that matches their author rank, which can be dangerous, cautioned, credible, reliable, or genuine. 
2. To parse the JSON data returned from the API, first, it needs to be encoded using `encodeURIComponent()`. Then, it needs to be parsed using `JSON.parse()` twice. The result is a JSON object containing `verifiedDetails`, which can be accessed using `verifiedDetails.authorRank`.
3. The `getPhotoBorderColor()` function receives a user's author rank and returns a CSS class to add to the profile picture's border. This class sets the color of the border to the user's corresponding rank color. The function uses a switch statement to match the rank with a bootstrap color.

## API Usage

To use TruAnon APIs, an HTTP GET request must be sent to the desired endpoint. For example, to get a user's verified details, the following endpoint should be used:


The response contains the user's verified details, including their author rank, which can be used to determine the color of their profile badge color. The response needs to be parsed and decoded properly to get the necessary data.

To populate data on the profile view page, jQuery can be used to select the desired elements by their ID and change their text or attributes. For example, to change the profile picture's border color, the jQuery `.addClass()` method can be used to add the CSS class returned by the `getPhotoBorderColor()` function to the profile picture's element.

## Conclusion

TruAnon APIs provide a convenient way to access user data for use on the profile view page. JSON parsing and decoding are necessary to use the data correctly, and proper use of jQuery can populate the data on the page.

## Route 1: Get User Profile

The first route, defined with `app.get('/users/:username', ...)`, retrieves a user's profile from the TruAnon API if the user's `switch_state` is set to `true`. Here's how the code works:

1. The route extracts the `username` parameter from the request URL and the `userId` from the session.
2. It then queries the database to retrieve the user's data using their `username`.
3. If an error occurs during the database query, the server responds with a `500 Internal Server Error` status code and a message explaining the error. If the user is not found, the server responds with a `404 Not Found` status code and a message indicating that the user was not found.
4. If the user is found, the route checks their `switch_state` property. If it is set to `true`, the route constructs a URL to fetch the user's profile data from the TruAnon API. It includes the `username` and `service` parameters, as well as the `Authorization` header, which is set to a private key.
5. The route then calls the `fetch` function to make a GET request to the TruAnon API using the constructed URL and the `tokenOptions` object that contains the `Authorization` header.

