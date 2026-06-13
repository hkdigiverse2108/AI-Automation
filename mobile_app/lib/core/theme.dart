import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Brand Colors
  static const Color waGreen = Color(0xFF00A884);
  static const Color waGreenDark = Color(0xFF006B53);
  static const Color waUnread = Color(0xFF00A884);

  // Light Mode Colors
  static const Color lightBgPrimary = Color(0xFFF5FAFF);
  static const Color lightBgSecondary = Color(0xFFF0F2F5);
  static const Color lightBgCard = Color(0xFFFFFFFF);
  static const Color lightTextPrimary = Color(0xFF131D23);
  static const Color lightTextSecondary = Color(0xFF546068);
  static const Color lightBorder = Color(0xFFE9EDEF);
  static const Color lightChatBg = Color(0xFFEFEAE2);
  static const Color lightBubbleIn = Color(0xFFFFFFFF);
  static const Color lightBubbleOut = Color(0xFFD9FDD3);
  static const Color lightPanelHeader = Color(0xFFE5EFF8);

  // Dark Mode Colors
  static const Color darkBgPrimary = Color(0xFF0B141A);
  static const Color darkBgSecondary = Color(0xFF111B21);
  static const Color darkBgCard = Color(0xFF111B21);
  static const Color darkTextPrimary = Color(0xFFE9EDEF);
  static const Color darkTextSecondary = Color(0xFF8696A0);
  static const Color darkBorder = Color(0xFF313D45);
  static const Color darkChatBg = Color(0xFF0B141A);
  static const Color darkBubbleIn = Color(0xFF202C33);
  static const Color darkBubbleOut = Color(0xFF005C4B);
  static const Color darkPanelHeader = Color(0xFF202C33);
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: AppColors.waGreen,
      scaffoldBackgroundColor: AppColors.lightBgPrimary,
      cardColor: AppColors.lightBgCard,
      dividerColor: AppColors.lightBorder,
      colorScheme: const ColorScheme.light(
        primary: AppColors.waGreen,
        secondary: AppColors.waGreenDark,
        surface: AppColors.lightBgCard,
        error: Colors.red,
      ),
      textTheme: GoogleFonts.interTextTheme().copyWith(
        titleLarge: const TextStyle(color: AppColors.lightTextPrimary, fontWeight: FontWeight.bold),
        bodyLarge: const TextStyle(color: AppColors.lightTextPrimary),
        bodyMedium: const TextStyle(color: AppColors.lightTextSecondary),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.lightBgCard,
        foregroundColor: AppColors.lightTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      cardTheme: CardTheme(
        color: AppColors.lightBgCard,
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      buttonTheme: const ButtonThemeData(
        buttonColor: AppColors.waGreen,
        textTheme: ButtonTextTheme.primary,
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      primaryColor: AppColors.waGreen,
      scaffoldBackgroundColor: AppColors.darkBgPrimary,
      cardColor: AppColors.darkBgCard,
      dividerColor: AppColors.darkBorder,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.waGreen,
        secondary: AppColors.waGreenDark,
        surface: AppColors.darkBgCard,
        error: Colors.redAccent,
      ),
      textTheme: GoogleFonts.interTextTheme().copyWith(
        titleLarge: const TextStyle(color: AppColors.darkTextPrimary, fontWeight: FontWeight.bold),
        bodyLarge: const TextStyle(color: AppColors.darkTextPrimary),
        bodyMedium: const TextStyle(color: AppColors.darkTextSecondary),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkBgCard,
        foregroundColor: AppColors.darkTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      cardTheme: CardTheme(
        color: AppColors.darkBgCard,
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }
}
