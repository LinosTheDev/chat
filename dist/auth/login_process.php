<?php
require_once 'firebase/firebase_config.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['email'];
    $password = $_POST['password'];

    try {
        $signInResult = $auth->signInWithEmailAndPassword($email, $password);
        // Redirect user to profile page after successful login
        header("Location: profile.php");
        exit();
    } catch (\Kreait\Firebase\Exception\Auth\UserNotFound $e) {
        // Handle if user not found
    } catch (\Kreait\Firebase\Exception\Auth\InvalidPassword $e) {
        // Handle if password is incorrect
    } catch (\Exception $e) {
        // Handle other errors
    }
}
?>