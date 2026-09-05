package com.tabby.household;

import static org.junit.Assert.assertEquals;

import java.util.Locale;
import org.junit.Before;
import org.junit.Test;

public class GroceryWidgetProviderTest {
    @Before
    public void useStableLocale() {
        Locale.setDefault(Locale.US);
    }

    @Test
    public void formatsWholeQuantitiesWithoutDecimals() {
        assertEquals("2", GroceryWidgetProvider.formatQuantity(2));
    }

    @Test
    public void formatsFractionalQuantitiesToOneDecimalPlace() {
        assertEquals("1.5", GroceryWidgetProvider.formatQuantity(1.5));
    }

    @Test
    public void hidesInvalidQuantities() {
        assertEquals("", GroceryWidgetProvider.formatQuantity(0));
        assertEquals("", GroceryWidgetProvider.formatQuantity(Double.NaN));
    }
}
