<?php

namespace App\Exceptions;

use RuntimeException;

/** The owner asked for something the booking's state does not allow. The message is shown to them. */
class BookingActionRefused extends RuntimeException {}
