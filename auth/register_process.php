<?php
require_once 'firebase/firebase_config.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST['username'];
    $email = $_POST['email'];
    $password = $_POST['password'];

    try {
        $user = $auth->createUserWithEmailAndPassword($email, $password);
        // Add additional user data to database if necessary
        header("Location: confirm_email.php");
        exit();
    } catch (\Kreait\Firebase\Exception\Auth\EmailExists $e) {
        // Handle if email already exists
    } catch (\Kreait\Firebase\Exception\Auth\WeakPassword $e) {
        // Handle if password is too weak
    } catch (\Exception $e) {
        // Handle other errors
    }
}
?>